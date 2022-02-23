// Ngan collect from d3 repo because d3.v5 don't have this function
// https://github.com/d3/d3-shape/blob/main/src/curve/bump.js

function pointRadial (x, y) {
    return [(y = +y) * Math.cos(x -= Math.PI / 2), y * Math.sin(x)];
}
class Bump {
    constructor(context, x) {
        this._context = context;
        this._x = x;
    }
    areaStart() {
        this._line = 0;
    }
    areaEnd() {
        this._line = NaN;
    }
    lineStart() {
        this._point = 0;
    }
    lineEnd() {
        if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
        this._line = 1 - this._line;
    }
    point(x, y) {
        x = +x, y = +y;
        switch (this._point) {
            case 0: {
                this._point = 1;
                if (this._line) this._context.lineTo(x, y);
                else this._context.moveTo(x, y);
                break;
            }
            case 1: this._point = 2; // falls through
            default: {
                if (this._x) this._context.bezierCurveTo(this._x0 = (this._x0 + x) / 2, this._y0, this._x0, y, x, y);
                else this._context.bezierCurveTo(this._x0, this._y0 = (this._y0 + y) / 2, x, this._y0, x, y);
                break;
            }
        }
        this._x0 = x, this._y0 = y;
    }
}

class BumpRadial {
    constructor(context) {
        this._context = context;
    }
    lineStart() {
        this._point = 0;
    }
    lineEnd() {}
    point(x, y) {
        x = +x, y = +y;
        if (this._point++ === 0) {
            this._x0 = x, this._y0 = y;
        } else {
            const p0 = pointRadial(this._x0, this._y0);
            const p1 = pointRadial(this._x0, this._y0 = (this._y0 + y) / 2);
            const p2 = pointRadial(x, this._y0);
            const p3 = pointRadial(x, y);
            this._context.moveTo(...p0);
            this._context.bezierCurveTo(...p1, ...p2, ...p3);
        }
    }
}

function bumpX(context) {
    return new Bump(context, true);
}

function bumpY(context) {
    return new Bump(context, false);
}

function bumpRadial(context) {
    return new BumpRadial(context);
}

d3.bumpX = bumpX;
d3.bumpY = bumpY;
d3.bumpRadial = bumpRadial;
