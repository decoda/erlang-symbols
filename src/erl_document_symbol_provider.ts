'use strict';
import {
  DocumentSymbolProvider,
  TextDocument,
  CancellationToken,
  SymbolInformation,
  SymbolKind,
  Location
} from 'vscode';

export default class ElrDocumentSymbolProvider implements DocumentSymbolProvider {
  private readonly comment_regex = /^\s*%/;
  private readonly function_regex = /^((\w+)\(.*\))\s*(when\s+.*)?\->/;
  private readonly funcline_regex = /^(\w+)\(.*,\s*$/;
  private readonly macro_regex = /^\s*\-define\((\w+),/;
  private readonly record_regex = /^\s*\-record\((\w+),/;
  public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
    return new Promise((resolve, reject) => {
      let symbols: {
        name: string,
        kind: SymbolKind,
        location: Location,
      }[] = [];

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

        const map: {[key:string]: number} = {};
        if (this.check_symbol_regx(document, line, symbols, map, this.function_regex, SymbolKind.Function))
          continue;

        if (this.check_symbol_regx(document, line, symbols, map, this.macro_regex, SymbolKind.Constant))
          continue;

        if (this.check_symbol_regx(document, line, symbols, map, this.record_regex, SymbolKind.Struct))
          continue;

        if (last_line !== "") {
          let lst = last_line.replace(/[\r\n]/g, '');
          let cur = line.text.replace(/(^\s*)/g, '');
          last_line = "";
          this.check_symbol_regx(document, line, symbols, map, this.function_regex, SymbolKind.Function, lst+cur);
          continue;
        }

        match = line.text.match(this.funcline_regex);
        if (match !== null)
          last_line = line.text
      }

      resolve(<any>symbols);
    });
  }

  private check_symbol_regx(document:any, line:any, symbols:any[], map:any, regx:any, kind:any, text:any=null): boolean {
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
      symbols.push({
        name: label,
        kind: kind,
        location: new Location(document.uri, line.range)
      })
      return true;
    }
    return false;
  }
}
