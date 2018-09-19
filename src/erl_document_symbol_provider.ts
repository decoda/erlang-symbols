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
  private readonly function_regex = /^((\w+)\(.*\))\s*(when\s+.*)?->/;
  private readonly macro_regex = /^\s*-define\((\w+),/;
  private readonly record_regex = /^\s*-record\((\w+),/;
  public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
    return new Promise((resolve, reject) => {
      let symbols = [];

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
        match = line.text.match(this.function_regex);
        if (match !== null) {
          const label = match[1].trim();
          if (map[label] == 1) {
            continue;
          }
          map[label] = 1;
          symbols.push({
            name: label,
            kind: SymbolKind.Function,
            location: new Location(document.uri, line.range)
          })
          continue;
        }
        match = line.text.match(this.macro_regex);
        if (match !== null) {
          const label = match[1].trim();
          if (map[label] == 2) {
            continue;
          }
          map[label] = 2;
          symbols.push({
            name: label,
            kind: SymbolKind.Constant,
            location: new Location(document.uri, line.range)
          })
          continue;
        }
        match = line.text.match(this.record_regex);
        if (match !== null) {
          const label = match[1].trim();
          if (map[label] == 3) {
            continue;
          }
          map[label] = 3;
          symbols.push({
            name: label,
            kind: SymbolKind.Struct,
            location: new Location(document.uri, line.range)
          })
          continue;
        }
      }

      resolve(<any>symbols);
    });
  }
}
