'use strict';
import {
  workspace,
  IndentAction,
  LanguageConfiguration
} from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as Q from 'q';

class SettingClass {
  public searchPaths: string[] = [];
  public includeFiles: string = "";
  public erlangPath: string = "";
  public erlangLibFiles: {[key:string]: string} = {};
  public autoComplete: boolean = false;
  public autoIndent: boolean = false;

  private readonly libNames = [
    "kernel", "inets", "stdlib", "erts", "mnesia", "sasl", "observer",
    "compiler", "tools"
  ];
  private readonly fsStat = Q.denodeify<fs.Stats>(fs.stat);
  private readonly fsReaddir = Q.denodeify<string[]>(fs.readdir);

  public init() {
    const config = workspace.getConfiguration('erlang-symbols');
    let paths = config.get("searchPaths") as Array<string>;
    const root: string = workspace.rootPath || "";
    this.searchPaths = paths.map(dir => path.join(root, dir));
    this.includeFiles = config.get("includeFiles") as string;
    this.erlangPath = config.get("erlangPath") as string;
    this.autoComplete = config.get("autoComplete") as boolean;
    this.autoIndent = config.get("autoIndent") as boolean;
  }

  public initErlangLibFiles() {
    if (!this.erlangPath) return;

    let libDir = path.join(this.erlangPath, "lib");
    if (!fs.existsSync(libDir)) return;

    let fThen = (files: string[]) => {
      for (let file of files) {
        let found = false;
        for (let name of this.libNames) {
          if (file.startsWith(name)) {
            found = true;
            break;
          }
        }
        if (found) {
          let p = path.join(libDir, file);
          this.handleDir(p, "src");
        }
      }
    };
    this.fsReaddir(libDir).then(fThen);
  }

  private dirIterate(dir: string) {
    this.fsReaddir(dir).then(
      files => {
        let handles = files.map(f => this.handleDir(dir, f));
        let fThen = (ret: Q.PromiseState<string|void>[]) => {
          for (let st of ret) {
            let val = st.value;
            if (val && st.state === 'fulfilled') {
              let name = path.basename(val);
              this.erlangLibFiles[name] = val;
            }
          }
        };
        Q.allSettled(handles).then(fThen);
      }
    )
  }

  private async handleDir(dir: string, ls: string) {
    let p = path.join(dir, ls);
    const st = await this.fsStat(p);
    if (st.isDirectory()) {
      return this.dirIterate(p);
    }
    else if (st.isFile() && p.endsWith(".erl")) {
      return p;
    }
  }

  public languageConfiguration(): LanguageConfiguration {
    let languageConfiguration: LanguageConfiguration = {
      comments: {
          lineComment: '%'
      },
      brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')'],
          ['<<', '>>']
      ],
      __characterPairSupport: {
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '<<', close: '>>', notIn: ['string', 'comment'] },
          { open: '"', close: '"', notIn: ['string'] },
          { open: '\'', close: '\'', notIn: ['string', 'comment'] }
        ]
      }
    }

    if (this.autoIndent) {
      languageConfiguration['indentationRules'] = {
        increaseIndentPattern: /^\s*([^%]*->|receive|if|fun|case\s+.*\s+of|try\s+.*\s+of|catch|after)\s*$/,
        decreaseIndentPattern: /\s+(catch|after)\s*$/
      }
      languageConfiguration['onEnterRules'] = [
        {
          beforeText: /^\s*([^%]*->|receive|if|fun|case\s+.*\s+of|try\s+.*\s+of)\s*$/,
          action: {
            indentAction: IndentAction.Indent
          }
        },
        {
          beforeText: /^\s*((?!(end|catch|after))[^,])*$/,
          action: {
            indentAction: IndentAction.Outdent
          }
        }
      ]
    }

    return languageConfiguration;
  }
}

export const Settings = new SettingClass();

