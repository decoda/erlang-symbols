'use strict';
import {
  workspace
} from 'vscode';
import * as path from 'path';

class SettingClass {
  public searchPaths: string[] = [];

  init() {
    const config = workspace.getConfiguration('erlang-symbols');
    let paths = ["src"];
    if (Array.isArray(config.get("searchPaths"))) {
      paths = config.get("searchPaths") as Array<string>;
    }
    const root: string = workspace.rootPath || "";
    this.searchPaths = paths.map(dir => path.join(root, dir));
  }
}

export const Settings = new SettingClass();

