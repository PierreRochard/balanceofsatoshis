const {test} = require('tap');

const {getBalance} = require('./../../balances');

const tests = [
  {
    args: {},
    description: 'LND is required',
    error: [400, 'ExpectedLndToGetBalance'],
  },
  {
    args: {
      lnd: {
        default: {
          channelBalance: ({}, cbk) => cbk(null, {
            balance: '1',
            pending_open_balance: '1',
          }),
          listChannels: ({}, cbk) => cbk(null, {
            channels: [{
              active: true,
              capacity: '1',
              chan_id: 1,
              channel_point: '1:1',
              commit_fee: 1,
              commit_weight: 1,
              fee_per_kw: 1,
              initiator: true,
              local_balance: 1,
              local_chan_reserve_sat: '1',
              num_updates: 1,
              pending_htlcs: [],
              private: true,
              remote_balance: 1,
              remote_chan_reserve_sat: 1,
              remote_pubkey: 'b',
              total_satoshis_received: 1,
              total_satoshis_sent: 1,
              unsettled_balance: 1,
            }],
          }),
          pendingChannels: ({}, cbk) => cbk(null, {
            pending_closing_channels: [],
            pending_force_closing_channels: [],
            pending_open_channels: [],
            total_limbo_balance: '1',
          }),
          walletBalance: ({}, cbk) => cbk(null, {
            confirmed_balance: '1',
            unconfirmed_balance: '1',
          }),
        },
      },
    },
    description: 'Get balances',
    expected: {balance: 4, channel_balance: 0},
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      rejects(getBalance(args), error, 'Got expected error');
    } else {
      const balances = await getBalance(args);

      equal(balances.balance, expected.balance, 'Balance is calculated');
      equal(balances.channel_balance, expected.channel_balance, 'Chan tokens');
    }

    return end();
  });
});
