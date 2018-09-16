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
  private fileCache: {[mod:string]: string} = {};
  private readonly externalMod: string[] = [
    "erlang", "lists", "gen_server", "gen", "ets", "mnesia", "io", "io_lib",
    "os", "string", "dict",
  ];

  private searchFile(dir: string, mod: string): string | undefined {
    let cache = this.fileCache[mod];
    if (cache) {
      let st = fs.statSync(cache);
      if (st.isFile()) {
        return cache;
      }
      delete this.fileCache[mod];
    }
    let modfile = mod + ".erl";
    let file = this.searchFileSub(dir, modfile);
    if (file) {
      this.fileCache[mod] = file;
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
    if (word.charCodeAt(0) < 90) {
      return Promise.resolve(null);
    }

    const wordre = new RegExp(`^${word}\\(.*\\)\\s*->`);
    let match = curline.match(new RegExp(`(\\w+):${word}\\b\\(`));
    if (match == null) {
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

    const mod = match[1];
    if (mod.charCodeAt(0) < 90) {
      return Promise.resolve(null);
    }
    if (this.externalMod.indexOf(mod) != -1) {
      return Promise.resolve(null);
    }

    let root = workspace.rootPath || "";
    let dir = path.join(root, "src");
    let p = this.searchFile(dir, mod) as string;
    if (!p) {
      return Promise.resolve(null);
    }

    let reader = readline.createInterface({ input: fs.createReadStream(p) });
    let count = 0;
    return new Promise((resolve, reject) => {
      reader.on('line', (line: string) => {
        match = line.match(wordre);
        if (match != null) {
          let uri = Uri.file(p);
          let r = new Range(new Position(count, 0), new Position(count, word.length));
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