'use strict';
import {
  workspace
} from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as Q from 'q';

class SettingClass {
  public searchPaths: string[] = [];
  public includeFiles: string = "";
  public erlangPath: string = "";
  public erlangLibFiles: {[key:string]: string} = {};

  private readonly libNames = [
    "kernel", "inets", "stdlilb", "erts", "mnesia", "sasl", "observer"
  ];
  private readonly fsStat = Q.denodeify<fs.Stats>(fs.stat);
  private readonly fsReaddir = Q.denodeify<string[]>(fs.readdir);

  public init() {
    const config = workspace.getConfiguration('erlang-symbols');
    let paths = config.get("searchPaths") as Array<string>;
    const root: string = workspace.rootPath || "";
    this.searchPaths = paths.map(dir => path.join(root, dir));
    this.includeFiles = config.get("includeFiles") as string;
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
}

export const Settings = new SettingClass();

