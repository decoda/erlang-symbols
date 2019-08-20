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
  readonly funLineRegex = /^([a-z]\w*)\(.*,\s*$/;

  readonly funItem: SymbolItem = { kind: SymbolKind.Function, regex: Utils.REGEX_FUNC };
  readonly macroItem: SymbolItem = { kind: SymbolKind.Constant, regex: Utils.REGEX_MACRO };
  readonly recordItem: SymbolItem = { kind: SymbolKind.Struct, regex: Utils.REGEX_RECORD };

  public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
    return new Promise((resolve, reject) => {
      let symbols: SymbolInformation[] = [];

      let lastLine = "";
      for (var i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        if (!line.text) {
          continue;
        }
        if (this.commentRegex.test(line.text)) {
          continue;
        }

        const map: {[key:string]: SymbolKind} = {};
        if (this.check_symbol_regx(document, line, symbols, map, this.funItem))
          continue;

        if (this.check_symbol_regx(document, line, symbols, map, this.macroItem))
          continue;

        if (this.check_symbol_regx(document, line, symbols, map, this.recordItem))
          continue;

        if (lastLine !== "") {
          let twoLine = Utils.combineTwoLine(lastLine, line.text);
          // combine two lines and check funtion symbol again
          this.check_symbol_regx(document, line, symbols, map, this.funItem, twoLine);
          lastLine = "";
        }
        else if (this.funLineRegex.test(line.text)) {
          lastLine = line.text
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
      const label: string = match[1].trim();
      if (map[label] == item.kind) {
          return true;
      }
      map[label] = item.kind;
      
      let location = new Location(document.uri, line.range);
      symbols.push(new SymbolInformation(label, item.kind, "", location));
      return true;
    }
    else {
      return false;
    }
  }
}
