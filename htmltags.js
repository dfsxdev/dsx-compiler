module.exports = {
    // void elements can��t have any contents (since there��s no end tag, no content can be put between the start tag and the end tag).
    'void': {
        'area': true, 
        'base': true, 
        'br': true, 
        'col': true, 
        'embed': true, 
        'hr': true, 
        'img': true, 
        'input': true, 
        'link': true, 
        'meta': true, 
        'param': true, 
        'source': true, 
        'track': true, 
        'wbr': true
    }, 
    // Escapable raw text elements can have text and character references, but the text must not contain an ambiguous ampersand.
    'escapableRaw': {
        'textarea': true, 
        'title': true
    }
};