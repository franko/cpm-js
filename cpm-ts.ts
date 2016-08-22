///<reference path="dataframe-ts.ts"/>

type NSDataFrame = DataFrame<number | string>;
type NSFactorValue = FactorValue<number | string>;
type NSFactorSpec = NSFactorValue[];

module LinEst {

    export function sumOccurrences(t: NSDataFrame, values: NSFactorSpec, y?: Vector<number>) {
        let sum = 0;
        for (let i = 1; i <= t.rows(); i++) {
            let yi = y ? y.e(i) : 1;
            sum += t.rowMatchFactors(i, values) ? yi : 0;
        }
        return sum;
    }

    export function buildFactorMatrix(tab: NSDataFrame, factors: NSFactorSpec[]) {
        let Kd: number[][] = [];
        for (let p = 0; p < factors.length; p++) {
            let Krow: number[] = [];
            for (let q = 0; q < factors.length; q++) {
                let s = 0;
                if (p === q) {
                    s = sumOccurrences(tab, factors[p]);
                } else {
                    let empty: NSFactorSpec = [];
                    let cf = empty.concat(factors[p]).concat(factors[q]);
                    s = sumOccurrences(tab, cf);
                }
                Krow.push(s);
            }
            Kd.push(Krow);
        }
        return new Matrix<number>(Kd);
    }

    export function buildFactorSumVector(tab: NSDataFrame, factors: NSFactorSpec[], y: Vector<number>) {
        let Kd: number[] = [];
        for (let p = 0; p < factors.length; p++) {
            let s = sumOccurrences(tab, factors[p], y)
            Kd.push(s);
        }
        return new Vector<number>(Kd);
    }

    export function evalRowExpected(factors: NSFactorSpec[], estimates: Vector<number>, tab: NSDataFrame, i) {
        let sum = 0;
        for (let p = 0; p < factors.length; p++) {
            let match = tab.rowMatchFactors(i, factors[p]);
            sum += match ? estimates.e(p + 1) : 0;
        }
        return sum;
    }

}


function erf(x: number) {
    let a1 = 0.254829592;
    let a2 = -0.284496736;
    let a3 = 1.421413741;
    let a4 = -1.453152027;
    let a5 = 1.061405429;
    let p = 0.3275911;

    // Save the sign of x
    let sign = 1;
    if (x < 0) {
        sign = -1;
    }
    x = Math.abs(x);

    // A&S formula 7.1.26
    let t = 1.0 / (1.0 + p * x);
    let y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
}

module CPM {

    export function stdDevEstimateBiasCorrect(stat: NSDataFrame, factors: NSFactorSpec[]) {
        let degOfFreedom = factors.length;
        let stdIndex = stat.colIndexOf("StdDev"), countIndex = stat.colIndexOf("Count");
        let nSum = 0;
        for (let i = 1; i <= stat.rows(); i++) {
            let count = stat.e(i, countIndex);
            if (typeof count === "string") { throw Error("internal error: \"count\" should be a number"); } else {
                nSum += count;
            }
        }
        for (let i = 1; i <= stat.rows(); i++) {
            let sigma = <number> stat.e(i, stdIndex);
            stat.elements[i - 1][stdIndex - 1] = sigma * Math.sqrt(nSum / (nSum - degOfFreedom));
        }
    }

    /* For a given "condition" (a factor) return the average of the terms "y", the
    * stddev of the residuals between "y" and the estimated values and the
    * number of terms. */
    export function elementResidualStats(tab: NSDataFrame, condition: NSFactorSpec, factors: NSFactorSpec[], estimates: Vector<number>, y: Vector<number>) {
        let sumsq = 0, n = 0, sum = 0;
        for (let i = 1; i <= tab.rows(); i++) {
            if (tab.rowMatchFactors(i, condition)) {
                let yEst = LinEst.evalRowExpected(factors, estimates, tab, i);
                sum += y.e(i);
                sumsq += Math.pow(yEst - y.e(i), 2);
                n += 1;
            }
        }
        return [sum / n, Math.sqrt(sumsq / n), n];
    }


    export function residualMeanSquares(tab: NSDataFrame, groups: NSFactorSpec[], factors: NSFactorSpec[], estimates: Vector<number>, y: Vector<number>) {
        let stat: (number | string)[][] = [];
        for (let p = 0; p < groups.length; p++) {
            let levelElem = groups[p].map((c) => { return c.value; });
            let statElem = elementResidualStats(tab, groups[p], factors, estimates, y);
            stat.push(levelElem.concat(statElem));
        }
        let statHeaders = groups[0].map((d) => { return tab.header(d.column); });
        statHeaders.push("Mean");
        statHeaders.push("StdDev");
        statHeaders.push("Count");
        let statTable = new DataFrame<number | string>(stat, statHeaders);
        stdDevEstimateBiasCorrect(statTable, factors);
        return stat;
    };

    export function gaussianDens(u: number, s: number, x: number) {
        return 1/(Math.sqrt(2*Math.PI) * s) * Math.exp(-Math.pow((x - u)/s, 2)/2);
    }

    /* Find the x that statisfies 'Integral_{-Inf}{x} f(x) dx = P' where f(x) is
       a mixture density probability distributions of N normal distributions given
       by stat and P is a given probability, the 'prob' argument.
       Use the newton method to find the solution of the equation. x0 should be
       "close enough" to the solution to ensure that the algorithm converges. */
    export function mixtureGaussianQuantiles(stat: NSDataFrame, prob: number, x0: number) {
        let meanIndex = stat.colIndexOf("Mean"), stdIndex = stat.colIndexOf("StdDev");
        let n = stat.rows();
        let us = <number[]> stat.elements.map((row) => { return row[meanIndex - 1]; });
        let ss = <number[]> stat.elements.map((row) => { return row[stdIndex - 1]; });

        let avg = 0;
        for (let i = 0; i < n; i++) {
            avg += us[i];
        }
        avg = avg / n;
        let sqrt2 = Math.sqrt(2);

        let f = (x) => {
            let p = 0;
            for (let i = 0; i < n; i++) {
                p += 0.5 * (1 + erf((x - us[i]) / (ss[i] * sqrt2)));
            }
            return p / n - prob;
        };
        let derf = (x) => {
            let p = 0;
            for (let i = 0; i < n; i++) {
                p += gaussianDens(us[i], ss[i], x);
            }
            return p / n;
        };
        let x = x0;
        for (let i = 0; i < 20; i++) {
            let xp = x;
            x = xp - f(xp) / derf(xp);
            if (Math.abs(x - xp) < Math.abs(avg) * 1e-5) {
                break;
            }
        }
        return x;
    };


    export function computeSigmaProcess(data: NSDataFrame, factors: NSFactorSpec[], estimates: Vector<number>) {
        let siteIndex = data.colIndexOf("Site");
        let s = 0, n = 0, ssq = 0;
        /* Count the linear estimate terms that corresponds to a simple
           site effect. */
        for (let i = 1; i <= estimates.dimensions(); i++) {
            let f = factors[i - 1];
            if (f.length == 1 && f[0].column == siteIndex) {
                let x = estimates.e(i);
                s += x;
                ssq += x * x;
                n++;
            }
        }
        // The average is divided by (n+1) because the first site is implicitly zero.
        // The overall difference is divided by n to obtain the *unbiased* estimation
        // of the standard deviation.
        return Math.sqrt(ssq / n - s * s / ((n + 1) * n));
    }

    export function computeByTool(stat: NSDataFrame, deltaSpec: number) {
        let stdIndex = stat.colIndexOf("StdDev");
        let toolIndex = stat.colIndexOf("Tool");
        let cpmData = [];
        for (let i = 1; i <= stat.rows(); i++) {
            let sigma = <number>stat.e(i, stdIndex);
            let cpm = deltaSpec / (6 * sigma);
            cpmData.push([stat.e(i, toolIndex), stat.e(i, stdIndex), cpm]);
        }
        return new DataFrame<number | string>(cpmData, ["Tool", "StdDev", "CPM"]);
    }

    export function computeCPMToolset(data: NSDataFrame, measuredParameter, deltaSpec, cpmSchema) {
        let measuredParamIndex = data.colIndexOf(measuredParameter);
        let siteIndex = data.colIndexOf("Site");
        let toolIndex = data.colIndexOf("Tool");
        let toolLevels = data.findLevels("Tool");

        let stat;
        let siteLevels = data.findLevels("Site");
        let measVector = data.col(measuredParamIndex);

        let cpm_factors = [
            [] // Represent the grand average.
        ];

        // Add a factor for each level of Site effect. First site is skipped.
        for (let k = 1, level; level = siteLevels[k]; k++) {
            cpm_factors.push([{ column: siteIndex, value: level }]);
        }

        // Add a factor for each level of Tool effect. First tool is skipped.
        for (let k = 1, level; level = toolLevels[k]; k++) {
            cpm_factors.push([{ column: toolIndex, value: level }]);
        }

        let tool_factors = [];
        for (let k = 0, level; level = toolLevels[k]; k++) {
            tool_factors.push([{ column: toolIndex, value: level }]);
        }

        let K = LinEst.buildFactorMatrix(data, cpm_factors);
        let S = LinEst.buildFactorSumVector(data, cpm_factors, measVector);
        let est = K.inverse().multiply(S); // Estimates.

        stat = Cpm.residualMeanSquares(data, tool_factors, cpm_factors, est, measVector);

        let cpmTable = Cpm.computeByTool(stat, deltaSpec);

        for (let i = 0; i < toolLevels.length; i++) {
            let dataTool = data.filter([{ column: toolIndex, value: toolLevels[i] }]);
            let plotSvg = d3.select("#toolrep").append("svg").attr("width", 640).attr("height", 480);
            plotByReprod(plotSvg, dataTool, measuredParamIndex);
        }

        let gaussPlotSvg = d3.select("#gaussplot").append("svg").attr("width", 640).attr("height", 480);
        plotToolDistrib(gaussPlotSvg, stat);

        let xL0 = d3.min(stat.elements, function (row) { return row[stat.colIndexOf("Mean") - 1] - 3 * row[stat.colIndexOf("StdDev") - 1]; });
        let xR0 = d3.max(stat.elements, function (row) { return row[stat.colIndexOf("Mean") - 1] + 3 * row[stat.colIndexOf("StdDev") - 1]; });
        let xL = Cpm.mixtureGaussianQuantiles(stat, 0.0013498980316301, xL0);
        let xR = Cpm.mixtureGaussianQuantiles(stat, 1 - 0.0013498980316301, xR0);

        let sigmaProcess = Cpm.computeSigmaProcess(data, cpm_factors, est);

        let resultDiv = d3.select("#cpmresult");
        resultDiv.append("h1").html("Results");
        resultDiv.append("p").html("\u03C3" + "<sub>process</sub> : " + sigmaProcess.toPrecision(5));
        renderTable(resultDiv.append("p"), cpmTable);
        resultDiv.append("p").html("CPM<sub>toolset</sub> : " + (deltaSpec / (xR - xL)).toPrecision(5));
    }

}
