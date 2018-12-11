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
    const startChar = curline.charAt(range.start.character - 1);
    const nextChar = curline.charAt(range.end.character);

    // macro
    if (startChar == '?' && /[A-Z0-9\_]/.test(word)) {
      // const pattern = new RegExp(`^\\s*\\-define\\($world}[\\(,]`);
      // return this.localMatch(pattern, document, 200).then(
      //   ret => ret,
      //   () => Utils.searchTextDirs(pattern, Settings.includeFiles).then(this.handleMatach)
      // )
      return this.handleMatach(Utils.searchSymbols(word, 1));
    }

    // must be lowercase
    const firstChar = word.charCodeAt(0);
    if (firstChar < 97 || firstChar > 122) {
      return null;
    }

    // record
    if ((nextChar == '{' || nextChar == '.') && startChar == '#') {
      return this.handleMatach(Utils.searchSymbols(word, 2));
    }

    const callPattern = new RegExp(`([a-z]\\w*):${word}\\(`);
    const pattern = new RegExp(`^${word}\\(.*\\)\\s*(when\\s+.*)?\\->`);
    let match = curline.match(callPattern);
    if (match == null) {
      // local function
      if (nextChar == '(' || nextChar == '/') {
        return this.localMatch(pattern, document, document.lineCount);
      }
      return null;
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

    return Utils.matchPattern(pattern, modfile).then(this.handleMatach);
  }

  private handleMatach(matchRet: {line: number, file: string, end: number} | undefined) {
    if (!matchRet) return null;

    let uri = Uri.file(matchRet.file);
    let r = new Range(matchRet.line, 0, matchRet.line,  matchRet.end);
    return new Location(uri, r);
  }

  private localMatch(pattern: RegExp, document: TextDocument, maxLine: number) {
    let maxLine2 = maxLine > document.lineCount ? document.lineCount : maxLine;
    return new Promise<Location>((resolve, reject) => {
      for (let i = 0; i < maxLine2; i++) {
        const line = document.lineAt(i);
        if (pattern.test(line.text)) {
          return resolve(new Location(document.uri, line.range));
        }
      }
      reject();
    });
  }
}
