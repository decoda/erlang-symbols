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
      return this.handleMatch(Utils.searchSymbols(word, 1) || Utils.searchLocalSymbols(document, position.line, word, 1));
    }

    // include
    const includePattern = new RegExp(`^\\s*\\-include\\("(${word}\\.hrl)"\\)\\.`);
    let match = curline.match(includePattern);
    if (match) {
      return Utils.locateIncludeFile(match[1]);
    }

    // must be lowercase
    const firstChar = word.charCodeAt(0);
    if (firstChar < 97 || firstChar > 122) {
      return null;
    }

    // record
    if (startChar == '#' && (nextChar == '{' || nextChar == '.')) {
      return this.handleMatch(Utils.searchSymbols(word, 2) || Utils.searchLocalSymbols(document, position.line, word, 2));
    }

    const callPattern = new RegExp(`([a-z]\\w*):${word}\\(`);
    const pattern = new RegExp(`^${word}\\(.*\\)\\s*(when\\s+.*)?\\->`);
    const funPattern = new RegExp(`%{word}\\(.*,\\s*$`);
    match = curline.match(callPattern);
    if (match == null) {
      // local function
      if (nextChar == '(' || nextChar == '/') {
        return this.localMatch(pattern, funPattern, document, document.lineCount);
      }
      return null;
    }

    // in other module file
    const mod: string = match[1];
    const filename = mod + ".erl";
    let modfile = Utils.searchFileDirs(Settings.searchPaths, filename);
    modfile = modfile || Settings.erlangLibFiles[filename];
    if (!modfile) {
      return null;
    }

    return Utils.matchPattern(pattern, funPattern, modfile).then(this.handleMatch);
  }

  private handleMatch(matchRet: {line: number, file: string, end: number} | undefined) {
    if (!matchRet) return null;

    let uri = Uri.file(matchRet.file);
    let r = new Range(matchRet.line, 0, matchRet.line, matchRet.end);
    return new Location(uri, r);
  }

  private localMatch(pattern: RegExp, funPattern: RegExp, document: TextDocument, maxLine: number) {
    let maxLine2 = maxLine > document.lineCount ? document.lineCount : maxLine;
    return new Promise<Location>((resolve, reject) => {
      let lastLine = "";
      for (let i = 0; i < maxLine2; i++) {
        const line = document.lineAt(i);
        if (pattern.test(line.text)) {
          return resolve(new Location(document.uri, line.range));
        }
        if (lastLine !== "") {
          // let twoLine = Utils.combineTwoLine(lastLine, line.text);
          let twoLine = lastLine + line.text;
          if (pattern.test(twoLine)) {
            return resolve(new Location(document.uri, line.range));
          }
          lastLine = "";
        }
        else if (funPattern && funPattern.test(line.text)) {
          lastLine = line.text;
        }
      }
      reject();
    });
  }
}
