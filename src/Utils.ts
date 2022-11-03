'use strict';
import {
  TextDocument,
  StatusBarItem,
  workspace,
} from 'vscode';
import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import * as Q from 'q';

interface SymbolCacheItem {
  [key: string]: {line: number, end: number}
}

interface SymbolCache {
  records: SymbolCacheItem,
  macros: SymbolCacheItem,
}

// definition search result
export type MatchResult = {
  file: string,
  line?: number,
  end?: number,
} | undefined;

export class Utils {
  private static fileCache: {[key:string]: string} = {};
  private static symbolCache: {[key:string]: SymbolCache} = {};

  public static readonly REGEX_FUNC = /^(([a-z]\w*)\(.*\))\s*(when\s+.*)?\->/;
  public static readonly REGEX_MACRO = /^\s*\-define\((\w+)[\\(,]/;
  public static readonly REGEX_RECORD = /^\s*\-record\((\w+),/;

  public static searchFileDirs(dirs: string[], filename: string): string {
    let cache: string = this.fileCache[filename];
    if (cache) {
      if (fs.existsSync(cache)) {
        return cache;
      }
      delete this.fileCache[filename];
    }

    for (let dir of dirs) {
      let file: string = this.searchFileSub(dir, filename);
      if (file) {
        this.fileCache[filename] = file;
        return file;
      }
    }
    return "";
  }

  private static searchFileSub(dir: string, filename: string): string {
    let files = fs.readdirSync(dir);
    for (let file of files) {
      let p = path.join(dir, file);
      if (file == filename) {
        return p;
      }

      let info = fs.statSync(p);
      if (info.isDirectory()) {
        let file = this.searchFileSub(p, filename);
        if (file) {
          return file;
        }
      }
    }
    return "";
  }

  public static searchFun(pattern: RegExp, funPattern: RegExp, file: string) {
    let deferred: Q.Deferred<MatchResult> = Q.defer();
    const rl = readline.createInterface({input: fs.createReadStream(file) });
    let line = 0;
    let accLine = 0;
    let matchTxt = "";
    let matchLine = 0;
    rl.on('line', (text: string) => {
      if (pattern.test(text)) {
        return deferred.resolve({file, line});
      }
      if (matchTxt !== "") {
        matchTxt = matchTxt + " " + text;
        if (pattern.test(matchTxt)) {
          return deferred.resolve({file, line: matchLine});
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
      line++;
    });
    rl.on('close', () => {
      deferred.reject();
    });
    rl.on('error', () => {
      deferred.reject();
    });
    return deferred.promise;
  }

  public static searchSymbols(symbol: string, kind: number) : MatchResult {
    let ret: {line: number, end: number};
    for (let key in this.symbolCache) {
      let cache = this.symbolCache[key];
      if (kind == 1) {
        ret = cache.macros[symbol];
        if (ret)
          return {file: key, line: ret.line, end: ret.end};
      }
      else {
        ret = cache.records[symbol];
        if (ret)
          return {file: key, line: ret.line, end: ret.end};
      }
    }
  }

  private static matchSymbols(file: string) {
    let macros: SymbolCacheItem = {};
    let records: SymbolCacheItem = {};
    let deferred: Q.Deferred<{macros: SymbolCacheItem, records: SymbolCacheItem, file: string}> = Q.defer();

    const rl = readline.createInterface({input: fs.createReadStream(file) });
    let line = 0;
    rl.on('line', (text: string) => {
      let end = text.length;
      let match = text.match(this.REGEX_MACRO);
      if (match) {
        macros[match[1].trim()] = {line, end};
      }
      else {
        match = text.match(this.REGEX_RECORD);
        if (match) {
          records[match[1].trim()] = {line, end};
        }
      }
      line++;
    });
    rl.on('close', () => {
      deferred.resolve({macros, records, file});
    });
    rl.on('error', () => {
      deferred.reject();
    });
    return deferred.promise;
  }

  public static parseIncludeFiles(globFiles: string, barItem: StatusBarItem) {
    workspace.findFiles(globFiles).then(
      uris => {
        let handles = uris.map(u => Utils.matchSymbols(u.fsPath));
        return Q.allSettled(handles).then(
          ret => {
            for (let st of ret) {
              let val = st.value;
              if (val && st.state === 'fulfilled') {
                Utils.symbolCache[val.file] = {macros: val.macros, records: val.records};
              }
            }
          }
        ).finally(() => {
          barItem.dispose();
        });
      }
    )
  }

  public static searchIncludeFile(includeFile: string): MatchResult {
    for (let key in this.symbolCache) {
      if (path.basename(key) == includeFile) {
        return {file: key, line: 0, end: 0};
      }
    }
  }

  public static resetDocumentFile(document: TextDocument) {
    let file = document.fileName;
    if (this.symbolCache[file] == null)
      return;

    let macros: SymbolCacheItem = {};
    let records: SymbolCacheItem = {};
    for (let i = 0; i < document.lineCount; ++i) {
      const line = document.lineAt(i);
      const text = line.text;
      let match = text.match(this.REGEX_MACRO);
      let end = text.length - 1;
      if (match) {
        macros[match[1].trim()] = {line: i, end};
      }
      else {
        match = text.match(this.REGEX_RECORD);
        if (match) {
          records[match[1].trim()] = {line: i, end};
        }
      }
    }
    this.symbolCache[file] = {macros, records};
  }

  public static clearCache() {
    this.fileCache = {};
    this.symbolCache = {};
  }

  public static removeSymbolCache(file: string) {
    delete this.symbolCache[file];
  }

  public static initSymbolCache(file: string) {
    this.symbolCache[file] = {macros: {}, records: {}};
  }

  public static loadSymbolCache(file: string) {
    Utils.matchSymbols(file).then(
      ret => {
        Utils.symbolCache[ret.file] = {macros: ret.macros, records: ret.records};
      }
    )
  }

}

