'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {
    ExtensionContext,
    languages
} from 'vscode';
import ElrDocumentSymbolProvider from './erl_document_symbol_provider';
import ElrDefinitionProvider from './erl_definition_provider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
    context.subscriptions.push(languages.registerDocumentSymbolProvider(
        { language: "erlang" }, new ElrDocumentSymbolProvider()
    ));
    context.subscriptions.push(languages.registerDefinitionProvider(
        { language: "erlang" }, new ElrDefinitionProvider()
    ))
}

// this method is called when your extension is deactivated
export function deactivate() {
}