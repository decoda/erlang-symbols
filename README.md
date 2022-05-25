# VS Code Erlang symbols
[![Build Status](https://travis-ci.com/decoda/erlang-symbols.svg?branch=master)](https://travis-ci.com/decoda/erlang-symbols)

Search symbols in erlang files.

## Features

* List symbols in module file
* Goto function definition (search function definition in configured path)
* Goto macro and record definition in include file

## Usage

```
npm install
npm run compile
npm install -g vsce
vsce package
```

## Release Notes

### 0.1.1
* load symbols on did create file

### 0.0.9
* Goto macro and record definition in include file

### 0.0.6
* Goto function definition

### 0.0.1
* Initial release

### Other
* Erlang syntax file inspired by <https://github.com/textmate/erlang.tmbundle/blob/master/Syntaxes/Erlang.plist>
