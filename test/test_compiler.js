const fs = require('fs');
const path = require('path');
const compile = require('../index');

let resolver = {
    resolve: (moduleType) => {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(__dirname, moduleType + '.dsxm'), 'utf8', (err, data) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        })
    }
};
fs.readFile(path.join(__dirname, 'test.dsx'), 'utf8', (err, data) => {
    compile(data, resolver, {
        newsList: [
            { title: 'news A', views: 100 }, 
            { title: 'news B', views: 80 }, 
            { title: 'news C', views: 0 }
        ], 
        title: 'abc', 
        message: 'def', 
        errors: ['error1', 'error2', 'error3'], 
        utils: {
            formatDate(date) {
                return JSON.stringify(date);
            }
        }, 
        content: {
            ts: (new Date()).getTime() / 1000
        }, 
        asyncVar1() {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve('abc');
                }, 100);
            });
        }, 
        asyncVar2() {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve('def');
                }, 100);
            });
        }
    }, {}).then((html) => {
        fs.writeFile(path.join(__dirname, 'test.html'), html, 'utf8', (err) => {
            console.log('done');
        });
    });
});
