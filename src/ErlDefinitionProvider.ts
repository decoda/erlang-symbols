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
import { Utils, MatchResult } from './Utils';

export default class ElrDefinitionProvider implements DefinitionProvider {

  public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition> {
    const curline = document.lineAt(position.line).text;
    if (/^\s*%/.test(curline)) {
      return null;
    }

    const range = document.getWordRangeAtPosition(position) as Range;
    if (!range) {
      return null;
    }

    const word = document.getText(range);
    const startChar = curline.charAt(range.start.character - 1);
    const nextChar = curline.charAt(range.end.character);

    // macro
    if (startChar == '?' && /[A-Z0-9\_]/.test(word)) {
      return this.handleMatch(Utils.searchSymbols(word, 1) || this.searchSymbols(document, position.line, word, 1));
    }

    // must be lowercase
    const firstChar = word.charCodeAt(0);
    if (firstChar < 97 || firstChar > 122) {
      return null;
    }

    // include
    const includePattern = new RegExp(`^\\s*\\-include\\("(${word}\\.hrl)"\\)\\.`);
    let match = curline.match(includePattern);
    if (match) {
      return this.handleMatch(Utils.searchIncludeFile(match[1]));
    }

    // record
    if (startChar == '#' && (nextChar == '{' || nextChar == '.')) {
      return this.handleMatch(Utils.searchSymbols(word, 2) || this.searchSymbols(document, position.line, word, 2));
    }

    const pattern = new RegExp(`^${word}\\(.*\\)\\s*(when\\s+.*)?\\->`);
    const funPattern = new RegExp(`${word}\\((?!->).*`);
    const callPattern = new RegExp(`([a-z\_]\\w*):${word}\\(`);
    const funcallPattern = new RegExp(`([a-z\_]\\w*):${word}/[0-9]+`);
    match = curline.match(callPattern);
    if (match == null) {
      match = curline.match(funcallPattern);
    }
    if (match == null) {
      // local function
      if (nextChar == '(' || nextChar == '/') {
        return this.searchFun(pattern, funPattern, document).then(this.handleMatch);
      }

      // erl file
      if (nextChar == ':' && /[a-z\_]\w*/.test(word)) {
        let modfile = this.searchErlFile(word);
        if (modfile) {
          return this.handleMatch({file: modfile});
        }
      }
    }
    else {
      // in other module file
      let modfile = this.searchErlFile(match[1]);
      if (modfile) {
        return Utils.searchFun(pattern, funPattern, modfile).then(this.handleMatch);
      }
    }
  }

  private handleMatch(matchRet: MatchResult) {
    if (!matchRet) return null;

    let uri = Uri.file(matchRet.file);
    let line = matchRet.line || 0;
    let end = matchRet.end || 0;
    let r = new Range(line, 0, line, end);
    return new Location(uri, r);
  }

  private searchSymbols(document: TextDocument, curLine: number, symbol: string, kind: number) : MatchResult {
    for (let i = 0; i < curLine; ++i) {
      const text = document.lineAt(i).text;
      let end = text.length - 1;
      let match = null;
      if (kind == 1) {
        match = text.match(Utils.REGEX_MACRO);
      }
      else {
        match = text.match(Utils.REGEX_RECORD);
      }
      if (match && match[1].trim() == symbol) {
        return {file: document.fileName, line: i, end};
      }
    }
  }

  // search local function
  private searchFun(pattern: RegExp, funPattern: RegExp, document: TextDocument) {
    return new Promise<MatchResult>((resolve, reject) => {
      let accLine = 0;
      let matchTxt = "";
      let matchLine = 0;
      let file = document.uri.fsPath;
      for (let line = 0; line < document.lineCount; line++) {
        const text = document.lineAt(line).text;
        if (pattern.test(text)) {
          return resolve({file, line});
        }
        if (matchTxt !== "") {
          matchTxt = matchTxt + " " + text;
          if (pattern.test(matchTxt)) {
            return resolve({file, line: matchLine});
          }
          accLine += 1;
          if (accLine >= 3) {
            matchTxt = "";
            accLine = 0;
            matchLine = 0;
          }
        }
        else if (funPattern.test(text)) {
          accLine = 1;
          matchTxt = text;
          matchLine = line;
        }
      }
      reject();
    });
  }

  private searchErlFile(mod: string) {
    const filename = mod + ".erl";
    let modfile = Utils.searchFileDirs(Settings.searchPaths, filename);
    return modfile || Settings.erlangLibFiles[filename];
  }
}
