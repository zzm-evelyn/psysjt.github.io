# scenario_only 单独情景测验入口

这个文件夹是一套独立前端入口，用来在不改动现有正式版 `frontend` 的前提下，让被试只完成一个情景测验。

## 入口

- `index.html`：单独情景测验入口
- `game.html`：情景测验作答页
- `result.html`：单独报告页

## 默认测验

默认只运行后台剧情分组里的 `game_a`。

如果要临时运行 `game_b`，可以使用：

```text
index.html?game=game_b
```

或者把 `index.html` 里的：

```js
const SCENARIO_ONLY_GAME_KEY = 'game_a';
```

改成：

```js
const SCENARIO_ONLY_GAME_KEY = 'game_b';
```

## 数据说明

这套入口复用现有阿里云后端和 OSS 数据结构，不会额外部署后端。

作答仍然写入：

```text
participants/{participant_id}/game_responses.json
```

报告仍然写入：

```text
participants/{participant_id}/game_reports.json
```

## 上传方式

如果你的 GitHub Pages / 静态前端支持子目录，把整个 `scenario_only` 文件夹上传到前端仓库即可。

访问路径通常类似：

```text
https://你的前端域名/scenario_only/
```

如果部署平台不会自动把目录下的 `index.html` 作为入口，就直接访问：

```text
https://你的前端域名/scenario_only/index.html
```
