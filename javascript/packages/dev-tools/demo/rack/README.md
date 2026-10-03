# Rack demo

A small Rack app for trying the two report middlewares against a real `Herb::Engine` rather than a hand written payload.

```bash
yarn nx build @herb-tools/dev-tools
bundle exec rackup javascript/packages/dev-tools/demo/rack/config.ru --port 9292 --server webrick
```

The app serves the dev tools bundle from `dist/` itself, so there is one server and no cross origin anything. Point `HERB_DEV_TOOLS` at something else to use a different build.

| Route | What it shows |
| --- | --- |
| `/valid` | A template that compiles. `Runtime::Middleware` injects what the page reported and the panel docks a badge in the corner. |
| `/broken` | A template that does not. The engine raises, nothing renders, and `Runtime::ErrorPage` answers with a page carrying the diagnostics as a blocking overlay. |
| `/broken.json` | The same failure asked for as JSON. The middleware raises on, so an XHR still fails the way it would have. |
| `/boom` | An error that is not Herb's, raised on untouched. |

`/broken` is worth loading twice, once as it is and once with the bundle missing. Without the script the page still names the template, the position, and the line, because the dev tools are an enhancement on top of a page that already says what is wrong.

Run `bundle exec herb dev javascript/packages/dev-tools/demo/rack/views` alongside it to watch the error page recover. It connects to the dev server like any other page, so closing the `<form>` in `views/broken.html.erb` reloads it and the article renders.
