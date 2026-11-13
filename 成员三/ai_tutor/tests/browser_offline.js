async (page) => {
  await page.getByLabel('你的问题').fill('mean怎么用');
  await page.locator('#send').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('无法连接本地服务'));
  if(await page.locator('#send').isDisabled())throw Error('Send button did not recover');
  return {passed:2,checks:['Actual service stop message','Send button recovered']};
}
