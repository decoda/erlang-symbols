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
  Uri
} from 'vscode';
import * as fs from 'fs';
import * as readline from 'readline';
import { Settings } from './Settings';
import { Utils } from './Utils';

export default class ElrDefinitionProvider implements DefinitionProvider {
  readonly externalMod: string[] = [
    "erlang", "lists", "gen_server", "gen", "ets", "mnesia", "io", "io_lib",
    "os", "string", "dict", "sets", "maps", "timer", "math"
  ];

  public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition> {
    const curline = document.lineAt(position.line).text;
    if (/^\s*%/.test(curline)) {
      return null;
    }

    const range = document.getWordRangeAtPosition(position) as Range;
    if (!range)
      return null;

    const word = document.getText(range);
    const firstChar = word.charCodeAt(0);
    // must be lowercase
    if (firstChar < 97 || firstChar > 122) {
      return null;
    }

    const wordre = new RegExp(`^${word}\\(.*\\)\\s*(when\\s+.*)?\\->`);
    const pattern = new RegExp(`([a-z]\\w*):${word}\\b\\(`);
    let match = curline.match(pattern);
    if (match == null) {
      // in current module file
      const nextChar = curline.charAt(range.end.character);
      if (!(nextChar == '(' || nextChar == '/')) {
        return null;
      }

      return new Promise((resolve, reject) => {
        let locate: Location | null = null;
        for (var i = 0; i < document.lineCount; i++) {
          const line = document.lineAt(i)
          if (wordre.test(line.text)) {
            locate = new Location(document.uri, line.range);
            break;
          }
        }
        resolve(locate);
      });
    }

    // in other module file
    const mod: string = match[1];
    if (this.externalMod.indexOf(mod) != -1) {
      return null;
    }

    const modfile = Utils.searchFileDirs(Settings.searchPaths, mod + ".erl");
    if (!modfile) {
      return null;
    }

    return this.searchSymbolInFile(modfile, word, wordre);
  }

  private searchSymbolInFile(modfile: string, word: string, wordre: RegExp, offset: number = 0) : ProviderResult<Definition> {
    const reader = readline.createInterface({ input: fs.createReadStream(modfile) });
    return new Promise((resolve, reject) => {
      let count = 0;
      reader.on('line', (line: string) => {
        let match = line.match(wordre);
        if (match != null) {
          let uri = Uri.file(modfile);
          let r = new Range(new Position(count, offset), new Position(count, word.length+offset));
          return resolve(new Location(uri, r));
        }
        count++;
      }).on('close', () => {
        resolve();
      }).on('error', () => {
        resolve();
      })
    })
  }
}
