# 年代长卷图

复用本仓库 `prototypes/era-pictures/img/t01.jpg` 至 `t10.jpg` 的十张原型画，未新生成图像。主游戏使用 640px 宽、quality 85 的 WebP 版本，共约 322KB。顺序、裁切位置和年代见 `src/game/eraTimeline.ts`。

转换方式：Sharp 读取对应原型 JPEG，执行 `.resize({ width: 640 }).webp({ quality: 85 }).toFile(...)`。原型保留原图，生产页面不依赖原型目录。
