const question = 'How many minutes does it take on average for Luke Bangs to score?';
const pattern = 'minutes does it take on average';
const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
console.log('Question:', question);
console.log('Pattern:', pattern);
console.log('Regex:', regex);
console.log('Match:', regex.test(question));
console.log('Match result:', question.match(regex));

