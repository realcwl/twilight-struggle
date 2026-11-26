# 十张画是怎么来的

用 Codex CLI 自带的图片生成工具做的，每张一次 `codex exec`，原图 1536×1024，这里存的是缩到 960×640 的 JPEG。
提示词由两部分拼成：每张各自的“画什么”，加上所有画共用的“怎么画”。要重做或补画，照这个格式即可。

## 共用的画法

```
Style: a realistic painted illustration, like a cinematic matte painting made from a period documentary photograph: believable materials, natural light, restrained period colour, fine brushwork that is barely visible.
Composition: ONE dominant subject with a strong, simple silhouette against a plain background, so the picture still reads when shrunk to a thumbnail 100 pixels wide. The subject sits inside the central square of the frame; the far left and far right hold only sky, ground or darkness.
Format: landscape, 3:2. The picture fills the whole canvas edge to edge: no circular plate, no vignette frame, no border, no film frame, no caption strip.
Strictly no text, letters, numbers, logos, insignia or flags anywhere. No recognisable individuals: any people are small, distant or seen from behind.
```

## 每张画什么

| 文件 | 画什么 |
|---|---|
| `t01.jpg` | The year 1948. A four-engine propeller transport aircraft coming in low over the broken walls and rubble of a bombed city at dawn, seen from the ground. A few small figures stand on a rubble mound watching it, seen from behind. Cold grey-blue sky, pale low sun. |
| `t02.jpg` | The year 1952. A thermonuclear test at dawn: a towering mushroom cloud rising from the ocean horizon beyond a Pacific atoll, a few small palm silhouettes in the foreground, the sea reflecting the orange glow. |
| `t03.jpg` | The year 1957. The first artificial satellite, a polished metal sphere with four long swept-back antennas, in orbit; the curved limb of the Earth glowing blue across the bottom of the frame, black space above. |
| `t04.jpg` | The year 1962. A medium-range ballistic missile lying on its long transporter trailer, half covered by camouflage netting, among tall palm trees, with canvas tents and a fuel truck nearby. Harsh tropical midday light, seen from a low oblique angle. |
| `t05.jpg` | The year 1969. A lunar landing craft with spindly gold-foil legs standing on the grey surface of the Moon; one astronaut in a white suit with a mirrored gold visor stands beside it; the Earth small in the black sky. Hard raking sunlight, long shadows. |
| `t06.jpg` | The year 1973. An oil field at dusk: a row of steel oil derricks and one burning gas flare against a deep orange sky, a pipeline running toward the viewer across desert sand. |
| `t07.jpg` | The year 1975. A single-rotor utility helicopter lifting off from the flat roof of a city building at dusk, a short line of small figures on a ladder below it, seen from a distance and from behind; a hazy tropical city skyline beyond. |
| `t08.jpg` | The year 1981. A winged reusable space shuttle with its large external fuel tank and two side boosters rising off the launch pad on a column of fire and billowing white steam, seen across flat marshland under a clear morning sky. |
| `t09.jpg` | The year 1983. A mobile ballistic missile launcher, a long multi-axle military truck with its missile canister raised upright, standing in a clearing of a snow-covered pine forest at blue dusk, headlights on, exhaust hanging in the cold air. |
| `t10.jpg` | The year 1989. Night. A crowd of small figures standing on top of a plain concrete border wall, seen from behind and below, arms raised, lit by floodlights; behind them a large neoclassical city gate with columns and a chariot statue on top; fireworks in the dark sky. |

## 一次生成的命令

```sh
# prompt.txt = "Use your built-in image generation tool ... save it as ./out/t05.png" + Subject + 上面的画法
codex exec --skip-git-repo-check -s workspace-write -c model_reasoning_effort=low - < prompt.txt
```

在一个不含项目文件的空目录里跑，提示词里只有画面描述。
