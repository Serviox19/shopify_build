default:
	npm install

clean:
	rm -rf node_modules
	npm cache verify
	npm install

start:
	npm run watch & npm run theme-watch

start-new:
	npm run watch

watch:
	npm run watch
