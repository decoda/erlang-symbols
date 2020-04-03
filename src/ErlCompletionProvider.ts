/// <ref href="../typings/tsd.d.ts">
// This file inspired by <https://github.com/yuce/erlang-vscode/blob/master/src/completion_provider.ts>
'use strict';
import {
  CompletionItemProvider,
  TextDocument,
  Position,
  CancellationToken,
  CompletionItem,
  CompletionItemKind
} from 'vscode';
import * as fs from 'fs';

const RE_MODULE = /(\w+):$/;

interface ModuleFunItem {
    [key: string]: string[]
}

export default class ErlCompletionProvider implements CompletionItemProvider {
  private modules: ModuleFunItem | null = null;
  private genericCompletionItems: CompletionItem[] | null = null;

  constructor(private completionPath: string) {}

  public provideCompletionItems(doc: TextDocument, pos: Position, token: CancellationToken): Thenable<CompletionItem[]> {
    return new Promise<CompletionItem[]>((resolve, reject) => {
      const line = doc.lineAt(pos.line);
      const m = RE_MODULE.exec(line.text.substring(0, pos.character));
        if (this.modules === null) {
          this.readCompletionJson(this.completionPath, (modules: ModuleFunItem) => {
            this.modules = modules;
            if (m === null)
              this.resolveModuleNames(resolve);
            else
              this.resolveFunNames(m[1], resolve);
          });
        } else if (m === null) {
          this.resolveModuleNames(resolve);
        }
        else {
          this.resolveFunNames(m[1], resolve);
        }
      });
    }

    private resolveFunNames(module: string, resolve: Function) {
      const moduleFuns = this.modules === null ? [] : this.modules[module];
      const moduleFunItems = moduleFuns.map(name => {
        return this.makeFunctionCompletionItem(name);
      })
      resolve(moduleFunItems);
    }

    private resolveModuleNames(resolve: Function) {
        if (!this.genericCompletionItems) {
          const modules = this.modules || {};
          const names = [];
          for (let k in modules) {
            names.push(k);
          }
          names.sort();
          this.genericCompletionItems = names.map(name => {
              return this.makeModuleNameCompletionItem(name);
          });
        }
        resolve(this.genericCompletionItems);
    }

    private makeFunctionCompletionItem(name: string): CompletionItem {
        const item = new CompletionItem(name);
        // item.documentation = cd.detail;
        item.kind = CompletionItemKind.Function;
        return item;
    }

    private makeModuleNameCompletionItem(name: string): CompletionItem {
        const item = new CompletionItem(name);
        item.kind = CompletionItemKind.Module;
        return item;
    }

    private readCompletionJson(filename: string, callback: (m: ModuleFunItem) => void): any {
        fs.readFile(filename, (err: NodeJS.ErrnoException, data: string | Buffer) => {
            if (err) {
                console.log(`Cannot read: ${filename}`);
                callback({});
            }
            else {
                let d: any = JSON.parse(data as string);
                callback(d);
            }
        });
    }
}