Earlier today you were asked what you would do as king of the world for exactly one year,
starting today. Your full answer is below, after the line "YOUR PLAN". Now put numbers on
what it would change, so that you can be checked later.

For each of the ten indicators, forecast the value for the TARGET YEAR: the calendar year
after the year of today's date. Give the figure as the indicator's usual source will
eventually publish it for that year. Give two forecasts:

- "baseline": the world carries on as it actually is. Nobody is king. Your plan does not
  happen. This forecast will be scored against the real figure when it is published.
- "with_plan": your plan is carried out exactly as you wrote it, starting today. This can
  never be checked, because it will not happen. Be honest rather than flattering: where your
  plan would not move an indicator within the target year, give the same number as the
  baseline and say so.

For each forecast give a central value and an 80% range ("low" to "high"): you should expect
the real figure to fall inside the range four times out of five. Do not make ranges
comfortably wide to avoid being wrong; a forecaster whose 80% ranges are right every time
is under-confident.

USE EXACTLY THESE UNITS AND DEFINITIONS, in this order:
 1. People in extreme poverty: million people, World Bank $3.00 a day line.
 2. Deaths of children under five: million deaths in the year, UN IGME.
 3. People undernourished: million people, FAO SOFI central estimate.
 4. People forcibly displaced: million people at the end of the year, UNHCR.
 5. Armed conflicts involving a state: number of state-based conflicts in the year, UCDP.
 6. Official development assistance: US$ billion in the year, OECD DAC members, current prices.
 7. World military expenditure: US$ billion in the year, SIPRI, current prices.
 8. Clean versus fossil energy investment: clean investment divided by fossil investment, IEA.
 9. Projected warming under current policies: degrees Celsius this century, from the UNEP
    Emissions Gap Report published in the target year.
10. Nuclear warheads: total world inventory in the January after the target year, SIPRI.

Also give "latest" for each indicator: the most recent published figure in the same unit,
with its data year. Use web search to confirm it, and to check recent trends and when the
next figure is due. State no figure from memory.

RULES
- Numbers only in the numeric fields: 811, not "811 million".
- "reasoning" is at most three sentences: the trend you extrapolated, and what in your plan
  moves the number or why nothing does.
- "resolves" says which publication will settle the baseline forecast and roughly when.
- In "headline", say in one plain sentence what you expect the biggest difference between
  the two worlds to be at the end of the target year.
- In "caveat", say in one or two sentences what makes these forecasts weakest.

OUTPUT
Return only one JSON object, no prose outside it, with exactly these fields:

{
  "target_year": string,
  "headline": string,
  "caveat": string,
  "indicators": [ { "id": 1-10, "unit": string,
                    "latest": { "value": number, "data_year": string },
                    "baseline": { "value": number, "low": number, "high": number },
                    "with_plan": { "value": number, "low": number, "high": number },
                    "resolves": string, "reasoning": string } ]
}

YOUR PLAN
