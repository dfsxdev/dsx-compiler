/*
 * tag: string
 * attrs: object
 * value: string
 * parent: object
 * children: object array
 * data: object
 * dataCopied: bool
 * delayDeleted: bool
 */
 
const TEXT_TAG = '#text';

function vnode(tag, attrs, value) {
    attrs = attrs || {};
    let normAttrs = {};
    for (let key in attrs) {
        normAttrs[key.toLowerCase().trim()] = attrs[key];
    }
    return {
        tag: tag.toLowerCase().trim(), 
        attrs: normAttrs, 
        value: value, 
        isElement() {
            return this.tag != TEXT_TAG;
        }, 
        isText() {
            return this.tag == TEXT_TAG;
        }, 
        hasDefaultText() {
            return (this.children && 
                this.children.length == 1 && 
                this.children[0].isText());
        }, 
        getDefaultText() {
            if(this.children && 
                this.children.length == 1 && 
                this.children[0].isText()) {
                return this.children[0].value;
            } else {
                throw new Error('default text does not exist.');
            }
        }, 
        setDefaultText(text) {
            if(this.children && 
                this.children.length == 1 && 
                this.children[0].isText()) {
                this.children[0].value = text;
            } else {
                throw new Error('default text does not exist.');
            }
        }, 
        appendChild(child) {
            this.children = this.children || [];
            this.children.push(child);
            child.parent = this;
        }, 
        insertChild(child, index) {
            this.children = this.children || [];
            this.children.splice(index, 0, child);
            child.parent = this;
        }, 
        removeChild(child) {
            if(!this.children) return;
            let childIndex = this.children.indexOf(child);
            if(childIndex >= 0) {
                this.children.splice(childIndex, 1);
            }
        }, 
        clone() {
            let result = Object.assign({}, this);
            result.attrs = Object.assign({}, this.attrs);
            //it's enough to just copy local data
            if(this.dataCopied && this.data) {
                result.data = Object.assign({}, this.data);
                if(result.data.local) {
                    result.data.local = Object.assign({}, this.data.local);
                }
            }
            if (this.children) {
                result.children = [];
                for (let i = 0; i < this.children.length; ++i) {
                    result.children.push(this.children[i].clone());
                    result.children[i].parent = result;
                }
            }
            return result;
        }
    };
};

module.exports = 
{
    TEXT_TAG: TEXT_TAG, 
    h(tag, attrs) {
        return vnode(tag, attrs);
    }, 
    t(value) {
        return vnode(TEXT_TAG, {}, value);
    }, 
    ht(tag, attrs, value) {
        let parent = vnode(tag, attrs);
        let child = vnode(TEXT_TAG, {}, value);
        parent.children = parent.children || [];
        parent.children.push(child);
        child.parent = parent;
        return parent;
    }
};