// From https://github.com/andrewseidl/node-quick-hull-2d/blob/master/quickhull.js
// License: MIT

import lr from "robust-orientation";

// these should probably use robust-sum, etc
function vectSum(a, b) {
    return a.map(function(val, i) { return a[i] + b[i]; });
}
function vectScale(a, b) {
    return a.map(function(val, i) { return a[i] * b; });
}
function vectDiff(a, b) {
    return vectSum(a, vectScale(b, -1));
}
function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1];
}

// calculates the closest distance from a point to a line formed by two points
// || (a-p) - ((a-p) \dot n) n ||
function distLineToPoint(a, b, p) {
    let n = vectDiff(b, a);
    n = vectScale(n, 1 / Math.sqrt(n[0] * n[0] + n[1] * n[1]));

    const amp = vectDiff(a, p);
    const d = vectDiff(amp, vectScale(n, (dot(amp, n))));
    return Math.sqrt(d[0] * d[0] + d[1] * d[1]);
}

function isStrictlyRight(p) {
    return lr(this.a, this.b, p) < 0 ? 1 : 0;
}

// sort the given points in CCW order
function sortHull(Sorig) {
    const S = Sorig.slice();
    const Ssorted = [];
    let last = S.shift();
    Ssorted.push(last);

    while (S.length > 0) {
        const curr = S.shift();
        const A = S.filter(isStrictlyRight, {a: curr, b: last});
        if (A.length === 0) {
            Ssorted.push(curr);
            last = curr;
        } else {
            S.push(curr);
        }
    }

    return Ssorted;
}

// remove colinear points
// assume that the input points are already sorted
// FIXME we could take this further and enforce points to be positively oriented
function removeColinearPoints(S) {
    const Sclean = [];
    const l = S.length;

    for (let i = 0; i < S.length; i++) {
        if ( lr(S[(i + l - 1) % l], S[i], S[(i + 1) % l]) !== 0 ) {
            Sclean.push(S[i]);
        }
    }

    return Sclean;
}

// QuickHull
// O'Rourke - Computational Geometry in C, p. 70
function quickHullInner(S, a, b) {
    if (S.length === 0) {
        return [];
    }

    const d = S.map(function(p) {return {dist: lr(a, b, p) * distLineToPoint(a, b, p), point: p};});
    d.sort(function(x, y) { return x.dist > y.dist ? 1 : -1; });
    const dd = d.map(function(pp) { return pp.point; });

    let c = d.pop();
    if (c.dist <= 0) {
        return [];
    }
    c = c.point;

    // seems like these should be reversed, but this works
    const A = dd.filter(isStrictlyRight, {a: c, b: a});
    const B = dd.filter(isStrictlyRight, {a: b, b: c});

    // FIXME need better way in case qHI returns []
    const ress = quickHullInner(A, a, c).concat([c], quickHullInner(B, c, b));
    return ress;

}

export default function quickHull(S) {
    if (S.length < 3) {
        return S;
    } else {
        const d = S.slice();
        // sort by x
        d.sort(function(a, b) {return a[0] > b[0] ? 1 : -1;});

        const a = d.shift();
        const b = d.pop();

        const S1 = S.filter(isStrictlyRight, {a: b, b: a});
        const S2 = S.filter(isStrictlyRight, {a: a, b: b});

        const x = quickHullInner(S1, a, b);
        const y = quickHullInner(S2, b, a);
        const res = [a].concat(x, [b], y);

        return removeColinearPoints(sortHull(res));
    }
}
