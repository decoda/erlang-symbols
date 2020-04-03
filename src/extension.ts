'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {
  ExtensionContext,
  TextDocument,
  RelativePattern,
  languages,
  workspace,
  window,
  Uri
} from 'vscode';
import ErlDocumentSymbolProvider from './ErlDocumentSymbolProvider';
import ErlDefinitionProvider from './ErlDefinitionProvider';
import ErlCompletionProvider from './ErlCompletionProvider';
import { Settings } from './Settings';
import { Utils } from './Utils';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  Settings.init();
  languages.setLanguageConfiguration('erlang', Settings.languageConfiguration());

  context.subscriptions.push(languages.registerDocumentSymbolProvider(
    { scheme: "file", language: "erlang" }, new ErlDocumentSymbolProvider()
  ));
  context.subscriptions.push(languages.registerDefinitionProvider(
    { scheme: "file", language: "erlang" }, new ErlDefinitionProvider()
  ));
  context.subscriptions.push(workspace.onDidSaveTextDocument((document: TextDocument) => {
    Utils.resetDocumentFile(document);
  }));
  if (Settings.autoComplete) {
    const completionJsonPath = context.asAbsolutePath("./priv/erlang-libs.json");
    context.subscriptions.push(languages.registerCompletionItemProvider(
      { scheme: "file", language: "erlang" }, new ErlCompletionProvider(completionJsonPath), ':'
    ));
  }

  if (workspace.workspaceFolders) {
    const pattern = new RelativePattern(workspace.workspaceFolders[0], Settings.includeFiles);
    const fileWatcher = workspace.createFileSystemWatcher(pattern, false, true);
    fileWatcher.onDidCreate((e: Uri) => {
        Utils.initSymbolCache(e.fsPath);
        Utils.loadSymbolCache(e.fsPath);
    });
    fileWatcher.onDidDelete((e: Uri) => Utils.removeSymbolCache(e.fsPath));
    context.subscriptions.push(fileWatcher);
  }

  let barItem = window.createStatusBarItem();
  barItem.show();
  barItem.text = "erlang-symbols parse include files...";
  Utils.parseIncludeFiles(Settings.includeFiles, barItem);
  context.subscriptions.push(barItem);

  Settings.initErlangLibFiles();
}

// this method is called when your extension is deactivated
export function deactivate() {
  Utils.clearCache();
}
