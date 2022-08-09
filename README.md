# VS Code Erlang symbols
[![Build Status](https://travis-ci.com/decoda/erlang-symbols.svg?branch=master)](https://travis-ci.com/decoda/erlang-symbols)

Erlang语言语法高亮及符号查找（基于正则表达式查询）

## 支持功能

* 列出模块文件中的符号列表
* 支持跳转到函数定义（可配置查询目录）
* 支持跳转到宏及Record定义

## 编译
```
npm install
npm run compile
```

## 打包
```
npm install -g vsce
vsce package
```

## 语法高亮
Erlang syntax file inspired by <https://github.com/textmate/erlang.tmbundle/blob/master/Syntaxes/Erlang.plist>
