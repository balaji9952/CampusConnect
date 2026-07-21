# Admin Portal

The web-based dashboard for Campus Connect administrators to manage departments, users, and view audit logs.

## Setup
Because this portal is built with Vanilla HTML, CSS, and JS, there is no build step required.

## Running Locally
You can serve the folder using any static web server. For example:
```bash
npx serve .
# or
python -m http.server 8000
```
Then navigate to `http://localhost:8000/login.html`.

## Configuration
Update the API base URL in the JavaScript API connector files (`assets/js/api.js` or `firebase.js`) to point to your running `backend-api` instance.
