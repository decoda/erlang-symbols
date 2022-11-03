'use strict';
import {
  DocumentSymbolProvider,
  TextDocument,
  TextLine,
  CancellationToken,
  SymbolInformation,
  SymbolKind,
  Location
} from 'vscode';
import { Utils } from './Utils';

interface SymbolItem {
    kind: SymbolKind;
    regex: RegExp;
}

export default class ElrDocumentSymbolProvider implements DocumentSymbolProvider {
  readonly commentRegex = /^\s*%/;
  readonly funLineRegex = /^([a-z]\w*)\((?!->).*/;

  readonly funItem: SymbolItem = { kind: SymbolKind.Function, regex: Utils.REGEX_FUNC };
  readonly macroItem: SymbolItem = { kind: SymbolKind.Constant, regex: Utils.REGEX_MACRO };
  readonly recordItem: SymbolItem = { kind: SymbolKind.Struct, regex: Utils.REGEX_RECORD };

  public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
    return new Promise((resolve, reject) => {
      let symbols: SymbolInformation[] = [];
      let accLine = 0;
      let matchTxt = "";
      let matchLine : TextLine | null = null;
      const map: {[key:string]: SymbolKind} = {};
      for (var i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text;
        if (!text)
          continue;

        if (this.commentRegex.test(text))
          continue;

        if (this.check_symbol_regx(document, line, symbols, map, this.funItem))
          continue;

        if (this.check_symbol_regx(document, line, symbols, map, this.macroItem))
          continue;

        if (this.check_symbol_regx(document, line, symbols, map, this.recordItem))
          continue;

        if (matchLine && line.lineNumber - matchLine.lineNumber == accLine) {
          matchTxt = matchTxt + " " + text;
          if (this.check_symbol_regx(document, matchLine || line, symbols, map, this.funItem, matchTxt)) {
            matchLine = null;
            continue;
          }
          accLine += 1;
          if (accLine >= 3) {
            matchTxt = "";
            accLine = 0;
            matchLine = null;
          }
        }
        else if (this.funLineRegex.test(text)) {
          accLine = 1;
          matchTxt = text;
          matchLine = line;
        }
      }
      resolve(symbols);
    });
  }

  private check_symbol_regx(document:TextDocument, line:TextLine, symbols:SymbolInformation[],
    map: {[key:string]: SymbolKind}, item: SymbolItem, text:string=""): boolean {
    if (!text) {
        text = line.text;
    }
    let match = text.match(item.regex);
    if (match !== null) {
      let label: string = match[1].trim();
      if (match[3]) {
        label = label + " " + match[3].trim();
      }
      if (map[label] == item.kind) {
          return true;
      }
      map[label] = item.kind;
      
      let location = new Location(document.uri, line.range);
      symbols.push(new SymbolInformation(label, item.kind, "", location));
      return true;
    }
    return false;
  }
}
