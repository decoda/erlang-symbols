'use strict';
import {
  DefinitionProvider,
  TextDocument,
  CancellationToken,
  Definition,
  Position,
  Range,
  ProviderResult,
  Location,
  Uri,
  workspace
} from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export default class ElrDefinitionProvider implements DefinitionProvider {
  private erlFileCache: {[mod:string]: string} = {};
  private hrlFileCache: {[mod:string]: string} = {};
  private readonly externalMod: string[] = [
    "erlang", "lists", "gen_server", "gen", "ets", "mnesia", "io", "io_lib",
    "os", "string", "dict", "sets", "maps", "timer", "math"
  ];

  private searchFile(dir: string, mod: string, suffix: string = ".erl"): string | undefined {
    let fileCache: {[mod:string]: string};
    if (suffix == ".erl")
      fileCache = this.erlFileCache;
    else if (suffix == ".hrl")
      fileCache = this.hrlFileCache;
    else
      return null;

    let cache = fileCache[mod];
    if (cache) {
      let st = fs.statSync(cache);
      if (st.isFile()) {
        return cache;
      }
      delete fileCache[mod];
    }
    let modfile = mod + suffix;
    let file = this.searchFileSub(dir, modfile);
    if (file) {
      fileCache[mod] = file;
    }
    return file;
  }

  private searchFileSub(dir: string, modfile: string): string | undefined {
    let files = fs.readdirSync(dir);
    for (let file of files) {
      let p = path.join(dir, file);
      if (file == modfile) {
        return p;
      }
      let info = fs.statSync(p);
      if (info.isDirectory()) {
        let file = this.searchFileSub(p, modfile);
        if (file) {
          return file;
        }
      }
    }
  }
  public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition> {
    const curline = document.lineAt(position.line).text;
    if (curline.match(/^\s*%/)) {
      return Promise.resolve(null);
    }
    if (position.character <= 0) {
      return Promise.resolve(null);
    }

    const range = document.getWordRangeAtPosition(position) as Range;
    const word = document.getText(range);
    const firstChar = word.charCodeAt(0);
    // must be lowercase
    if (firstChar < 97 || firstChar > 122) {
      return Promise.resolve(null);
    }

    const wordre = new RegExp(`^${word}\\(.*\\)\\s*(when\\s+.*)?\\->`);
    const pattern = new RegExp(`([a-z]\\w*):${word}\\b\\(`);
    let match = curline.match(pattern);
    if (match == null) {
      // in current module file
      const nextChar = curline.charAt(range.end.character);
      if (!(nextChar == '(' || nextChar == '/')) {
        return Promise.resolve(null);
      }

      return new Promise((resolve, reject) => {
        let locate;
        for (var i = 0; i < document.lineCount; i++) {
          const line = document.lineAt(i)
          const match = line.text.match(wordre);
          if (match !== null) {
            locate = new Location(document.uri, line.range);
            break;
          }
        }
        resolve(<any>locate);
      });
    }

    // in other module file
    const mod: string = match[1];
    if (this.externalMod.indexOf(mod) != -1) {
      return Promise.resolve(null);
    }

    const modfile = getSymbolFile(mod);
    if (!modfile) {
      return Promise.resolve(null);
    }

    return searchSymbolInFile(modfile, word, wordre);
  }

  private getSymbolFile(mod: string) {
    let root = workspace.rootPath || "";
    const config = workspace.getConfiguration('erlang-symbols');
    let paths = ["src"];
    if (Array.isArray(config.get("searchPaths"))) {
      paths = config.get("searchPaths") as Array<string>;
    }
    let p: string = "";
    for (let subPath of paths) {
      let dir = path.join(root, subPath);
      p = this.searchFile(dir, mod) as string;
      if (p) break;
    }
    return p;
  }

  private searchSymbolInFile(modfile: string, word: string, wordre: any, offset: number = 0) {
    let reader = readline.createInterface({ input: fs.createReadStream(modfile) });
    return new Promise((resolve, reject) => {
      reader.on('line', (line: string) => {
        match = line.match(wordre);
        if (match != null) {
          let uri = Uri.file(modfile);
          let r = new Range(new Position(count, offset), new Position(count, word.length+offset));
          resolve(new Location(uri, r));
        }
        count++;
      }).on('close', () => {
        resolve(null);
      }).on('error', () => {
        resolve(null);
      })
    })
  }
}
