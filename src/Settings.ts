'use strict';
import {
  workspace
} from 'vscode';
import * as path from 'path';

class SettingClass {
  public searchPaths: string[] = [];
  public includeFiles: string = "";

  init() {
    const config = workspace.getConfiguration('erlang-symbols');
    let paths = config.get("searchPaths") as Array<string>;
    const root: string = workspace.rootPath || "";
    this.searchPaths = paths.map(dir => path.join(root, dir));
    this.includeFiles = config.get("includeFiles") as string;
  }
}

export const Settings = new SettingClass();

