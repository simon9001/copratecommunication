import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

let current = 1
let jump = 10

setInterval(() => {
  if (current < 10) {
    current++
  } else {
    current += jump
    jump += 10
  }

  if (current > 1_000_000) {
    current = 1
    jump = 10
  }
}, 1000)

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Counter</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }

          h1 {
            font-size: 80px;
          }
        </style>
      </head>

      <body>
        <h1 id="counter">${current}</h1>

        <script>
          setInterval(async () => {
            const response = await fetch('/');
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            document.getElementById('counter').textContent =
              doc.getElementById('counter').textContent;
          }, 1000);
        </script>
      </body>
    </html>
  `)
})
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
