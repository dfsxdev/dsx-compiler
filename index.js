const parser = require('./parser');
const generator = require('./generator');

module.exports = function (template, resolver, localData, globalData) {
    return parser(globalData, localData, template, resolver)
    .then((entryModule) => {
        return generator(entryModule);
    });
};

