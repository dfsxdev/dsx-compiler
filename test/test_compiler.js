const fs = require('fs');
const path = require('path');
const compile = require('../index');

let resolver = {
    resolve: (moduleType) => {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(__dirname, moduleType + '.module'), 'utf8', (err, data) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        })
    }
};
fs.readFile(path.join(__dirname, 'test.template'), 'utf8', (err, data) => {
    compile(data, resolver, {
        title: 'abc', 
        message: 'def', 
        errors: ['error1', 'error2', 'error3']
    }, {}).then((html) => {
        fs.writeFile(path.join(__dirname, 'test.html'), html, 'utf8', (err) => {
            console.log('done');
        });
    });
});
