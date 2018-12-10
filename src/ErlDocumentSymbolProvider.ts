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

interface ISymbolItem {
    kind: SymbolKind;
    regex: RegExp;
}

export default class ElrDocumentSymbolProvider implements DocumentSymbolProvider {
  readonly comment_regex = /^\s*%/;
  readonly funcline_regex = /^([a-z]\w*)\(.*,\s*$/;

  readonly fun_item: ISymbolItem = { kind: SymbolKind.Function, regex: /^(([a-z]\w*)\(.*\))\s*(when\s+.*)?\->/ };
  readonly macro_item: ISymbolItem = { kind: SymbolKind.Constant, regex: /^\s*\-define\((\w+),/ };
  readonly record_item: ISymbolItem = { kind: SymbolKind.Struct, regex: /^\s*\-record\((\w+),/ };

  public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
    return new Promise((resolve, reject) => {
      let symbols: SymbolInformation[] = [];

      let last_line = "";
      for (var i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        if (!line.text) {
          continue;
        }
        let match = line.text.match(this.comment_regex);
        if (match !== null) {
          continue;
        }

        const map = new Map<string, SymbolKind>;
        if (this.check_symbol_regx(document, line, symbols, map, this.fun_item))
          continue;

        if (this.check_symbol_regx(document, line, symbols, map, this.macro_item))
          continue;

        if (this.check_symbol_regx(document, line, symbols, map, this.record_item))
          continue;

        if (last_line !== "") {
          let lst = last_line.replace(/[\r\n]/g, '');
          let cur = line.text.replace(/(^\s*)/g, '');
          last_line = "";
          // combine two lines and check funtion symbol again
          this.check_symbol_regx(document, line, symbols, map, this.fun_item, lst+cur);
          continue;
        }

        match = line.text.match(this.funcline_regex);
        if (match !== null)
          last_line = line.text
      }

      resolve(symbols);
    });
  }

  private check_symbol_regx(document:TextDocument, line:TextLine, symbols:SymbolInformation[],
      map:Map<string, SymbolKind>, item:ISymbolItem, text:string=null): boolean {
    if (text == null) {
        text = line.text;
    }
    let match = text.match(regx);
    if (match !== null) {
      const label = match[1].trim();
      if (map[label] == kind) {
          return true;
      }
      map[label] = kind;
      
      let location = new Location(document.uri, line.range);
      symbols.push(new SymbolInformation(label, item.kind, label, location));
      return true;
    }
    else {
      return false;
    }
  }
}
