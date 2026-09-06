# 高阶双音节词录音 (HSK 7-9) — Test 2 用

会议决议 (2026-07-08): Test 2 听辨要用学生**不认识**的高阶词，
否则学过的词是"记得"而不是"听出来"的。

录音放进本目录下的声调子文件夹，命名规则与 disyllables/ 相同：
    disyllables-adv/24/qie4ti1... → <拼音1><声调1><拼音2><声调2>.m4a
    例: 34/lv3xing2.m4a

放好后运行:  node scripts/buildDisyllableManifest.mjs
Test 2 会自动优先抽取本目录的词；没有高阶词的声调组合回退用原词库。
