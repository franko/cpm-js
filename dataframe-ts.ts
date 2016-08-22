interface FactorValue<T> {
    column: number;
    value: T;
}

class Matrix<T> {
    constructor(public elements: T[][]) { }

    rows() {
        return this.elements.length;
    }

    cols() {
        if (this.elements.length === 0) { return 0; }
        return this.elements[0].length;
    }

    e(i: number, j: number) {
        if (i < 1 || i > this.elements.length || j < 1 || j > this.elements[0].length) { throw Error("index out of bounds"); }
        return this.elements[i - 1][j - 1];
    }

    col(j: number) {
        if (this.elements.length === 0) { throw Error("Empty matrix"); }
        if (j < 1 || j > this.elements[0].length) { throw Error("index out of bounds"); }
        let col: T[] = [], n = this.elements.length;
        for (let i = 0; i < n; i++) { col.push(this.elements[i][j - 1]); }
        return new Vector(col);
    }
};

class DataFrame<T> extends Matrix<T> {
    constructor(elements: T[][], public headers: string[]) {
        super(elements);
    }

    colIndexOf(name: string) {
        return this.headers.indexOf(name) + 1;
    }

    header(i: number) {
        if (i < 1 || i > this.headers.length) throw Error("index out of bounds");
        return this.headers[i - 1];
    }

    rowMatchFactors(i: number, values: FactorValue<T>[]) {
        let match = 0;
        let kno = values.length;
        for (let k = 0; k < kno; k++) {
            let j = values[k].column, xval = values[k].value;
            if (this.e(i, j) === xval) {
                match += 1;
            }
        }
        return (match == kno);
    }

    findLevels(name: string) {
        let j = this.colIndexOf(name);
        let levels: T[] = [];
        for (let i = 1; i <= this.rows(); i++) {
            let y = this.e(i, j);
            if (levels.indexOf(y) < 0) {
                levels.push(y);
            }
        }
        return levels;
    }

};

class Vector<T> {
    constructor(public elements: T[]) { }

    e(i: number) {
        if (i < 1 || i > this.elements.length) { throw Error("index out of bounds"); }
        return this.elements[i - 1];
    }

    dimensions() {
        return this.elements.length;
    }
}
