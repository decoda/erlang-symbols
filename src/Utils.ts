
import * as path from 'path';
import * as fs from 'fs';

export class Utils {
  private static fileCache: {[key:string]: string} = {};

  public static searchFileDirs(dirs: string[], filename: string): string {
    for (let dir of dirs) {
      let absname = this.searchFileDir(dir, filename);
      if (absname)
        return absname;
    }
    return "";
  }

  public static searchFileDir(dir: string, filename: string): string {
    let cache: string = this.fileCache[filename];
    if (cache) {
      let st = fs.statSync(cache);
      if (st.isFile()) {
        return cache;
      }
      delete this.fileCache[filename];
    }

    let file: string = this.searchFileSub(dir, filename);
    if (file) {
      this.fileCache[filename] = file;
    }
    return file;
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

}
