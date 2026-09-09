# Portfolio

Personal academic site for Irfan Gazi — <https://irfan-gazi0.github.io/Portfolio/>

A static site with no build step. `index.html` is the 2D page (styles and
scripts inline); `xr/` is a 3D version of the same CV, built with three.js.

## Local preview

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000> for the 2D page and <http://localhost:8000/xr/>
for the 3D site. It must be served over HTTP, not opened as a `file://` path.
