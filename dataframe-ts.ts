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

module LinAlg {
    export function I(n: number) {
        let els: number[][] = [], i = n, j;
        while (i--) {
            j = n;
            els[i] = [];
            while (j--) {
                els[i][j] = (i === j) ? 1 : 0;
            }
        }
        return new Matrix<number>(els);
    }

    // Taken from: http://blog.acipo.com/matrix-inversion-in-javascript/
    export function inverse(matrix: Matrix<number>) {
        // Returns the inverse of matrix `M`.
        // I use Guassian Elimination to calculate the inverse:
        // (1) 'augment' the matrix (left) by the identity (on the right)
        // (2) Turn the matrix on the left into the identity by elemetry row ops
        // (3) The matrix on the right is the inverse (was the identity matrix)
        // There are 3 elemtary row ops: (I combine b and c in my code)
        // (a) Swap 2 rows
        // (b) Multiply a row by a scalar
        // (c) Add 2 rows

        let M = matrix.elements;
        //if the matrix isn't square: exit (error)
        if (M.length !== M[0].length) { throw Error("non-square matrix"); }

        //create the identity matrix (I), and a copy (C) of the original
        var i = 0, ii = 0, j = 0, dim = M.length, e = 0, t = 0;
        var I = [], C = [];
        for (i = 0; i < dim; i += 1) {
            // Create the row
            I[I.length] = [];
            C[C.length] = [];
            for (j = 0; j < dim; j += 1) {

                //if we're on the diagonal, put a 1 (for identity)
                if (i == j) { I[i][j] = 1; }
                else { I[i][j] = 0; }

                // Also, make the copy of the original
                C[i][j] = M[i][j];
            }
        }

        // Perform elementary row operations
        for (i = 0; i < dim; i += 1) {
            // get the element e on the diagonal
            e = C[i][i];

            // if we have a 0 on the diagonal (we'll need to swap with a lower row)
            if (e == 0) {
                //look through every row below the i'th row
                for (ii = i + 1; ii < dim; ii += 1) {
                    //if the ii'th row has a non-0 in the i'th col
                    if (C[ii][i] != 0) {
                        //it would make the diagonal have a non-0 so swap it
                        for (j = 0; j < dim; j++) {
                            e = C[i][j];       //temp store i'th row
                            C[i][j] = C[ii][j];//replace i'th row by ii'th
                            C[ii][j] = e;      //repace ii'th by temp
                            e = I[i][j];       //temp store i'th row
                            I[i][j] = I[ii][j];//replace i'th row by ii'th
                            I[ii][j] = e;      //repace ii'th by temp
                        }
                        //don't bother checking other rows since we've swapped
                        break;
                    }
                }
                //get the new diagonal
                e = C[i][i];
                //if it's still 0, not invertable (error)
                if (e == 0) { return }
            }

            // Scale this row down by e (so we have a 1 on the diagonal)
            for (j = 0; j < dim; j++) {
                C[i][j] = C[i][j] / e; //apply to original matrix
                I[i][j] = I[i][j] / e; //apply to identity
            }

            // Subtract this row (scaled appropriately for each row) from ALL of
            // the other rows so that there will be 0's in this column in the
            // rows above and below this one
            for (ii = 0; ii < dim; ii++) {
                // Only apply to other rows (we want a 1 on the diagonal)
                if (ii == i) { continue; }

                // We want to change this element to 0
                e = C[ii][i];

                // Subtract (the row above(or below) scaled by e) from (the
                // current row) but start at the i'th column and assume all the
                // stuff left of diagonal is 0 (which it should be if we made this
                // algorithm correctly)
                for (j = 0; j < dim; j++) {
                    C[ii][j] -= e * C[i][j]; //apply to original matrix
                    I[ii][j] -= e * I[i][j]; //apply to identity
                }
            }
        }

        //we've done all operations, C should be the identity
        //matrix I should be the inverse:
        return new Matrix<number>(I);
    }

    function multiply_raw(A: number[][], B: number[][]) {
        let i = A.length, nj = B[0].length, j;
        let cols = A[0].length;
        var elements: number[][] = [];
        while (i--) {
            j = nj;
            elements[i] = [];
            while (j--) {
                let c = cols;
                let sum = 0;
                let Arow_i = A[i];
                while (c--) {
                    sum += Arow_i[c] * B[c][j];
                }
                elements[i][j] = sum;
            }
        }
        return elements;
    }

    export function multiply(A: Matrix<number>, B: Matrix<number>) {
        if (A.elements.length === 0) { throw Error("empty matrix"); }
        if (A.cols() != B.rows()) { throw Error("dimensions mismatch"); }
        let elements = multiply_raw(A.elements, B.elements);
        return new Matrix(elements);
    }

    export function multiplyVector(A: Matrix<number>, B: Vector<number>) {
        if (A.elements.length === 0) { throw Error("empty matrix"); }
        if (A.cols() != B.dimensions()) { throw Error("dimensions mismatch"); }
        let i = A.elements.length;
        let cols = A.elements[0].length;
        var elements: number[] = [];
        while (i--) {
            let c = cols;
            let sum = 0;
            let Arow_i = A[i], B_vec = B.elements;
            while (c--) {
                sum += Arow_i[c] * B_vec[c];
            }
            elements[i] = sum;
        }
        return new Vector(elements);
    }
}

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
