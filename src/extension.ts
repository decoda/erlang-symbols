'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {
  ExtensionContext,
  TextDocument,
  languages,
  workspace,
  window,
  Uri
} from 'vscode';
import ElrDocumentSymbolProvider from './ErlDocumentSymbolProvider';
import ElrDefinitionProvider from './ErlDefinitionProvider';
import { Settings } from './Settings';
import { Utils } from './Utils';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  Settings.init();

  context.subscriptions.push(languages.registerDocumentSymbolProvider(
    { language: "erlang" }, new ElrDocumentSymbolProvider()
  ));
  context.subscriptions.push(languages.registerDefinitionProvider(
    { language: "erlang" }, new ElrDefinitionProvider()
  ));
  context.subscriptions.push(workspace.onDidSaveTextDocument((document: TextDocument) => {
    Utils.resetDocumentFile(document);
  }));

  const fileWatcher = workspace.createFileSystemWatcher("**/*.hrl", false, true);
  fileWatcher.onDidCreate((e: Uri) => Utils.initSymbolCache(e.fsPath));
  fileWatcher.onDidDelete((e: Uri) => Utils.removeSymbolCache(e.fsPath));

  let barItem = window.createStatusBarItem();
  barItem.show();
  barItem.text = "erlang-symbols parse include files...";
  Utils.parseIncludeFiles(Settings.includeFiles, barItem);
}

// this method is called when your extension is deactivated
export function deactivate() {
  Utils.clearCache();
}
