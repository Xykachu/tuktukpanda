const config = {
    suggestionsApiUrl: 'https://2ru8e32i17.execute-api.eu-west-1.amazonaws.com/dev/getSuggestions',
    sentimentApiUrl: 'https://2ru8e32i17.execute-api.eu-west-1.amazonaws.com/dev/analyse',
    score: {
        bigbad: { text: 'Very negative', colour: '#C91414' },
        bad: { text: 'Negative', colour: '#E3071D' },
        smolbad: { text: 'Slightly negative', colour: '#FF7E01' },
        neutral: { text: 'Neutral', colour: '#000000' },
        smolgood: { text: 'Slightly positive', colour: '#FFBE00' },
        good: { text: 'Positive', colour: '#75AD6F' },
        biggood: { text: 'Very positive', colour: '#1D7044' },
    },
};
