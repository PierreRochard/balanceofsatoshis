const asyncAuto = require('async/auto');
const {chanFormat} = require('bolt07');
const {getChannel} = require('ln-service');
const {getNetworkGraph} = require('ln-service');
const {getPayment} = require('ln-service');
const moment = require('moment');
const {returnResult} = require('asyncjs-util');

const asBigUnit = tokens => (tokens / 1e8).toFixed(8);
const standardIdHexLength = Buffer.alloc(32).toString('hex').length;

/** Get record

  Try to find a record by id

  {
    lnd: <Authenticated LND gRPC API Object>
    query: <Query String>
  }

  @returns via cbk or Promise
  {
    [channels]: [<Channel Object>]
    [nodes]: [<Node Object>]
    [payment]: <Payment Object>
    [payment_failed]: <Payment Failed Object>
    [payment_pending]: <Payment Pending Bool>
  }
*/
module.exports = ({lnd, query}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!lnd) {
          return cbk([400, 'ExpectedLndObjectToFindRecord']);
        }

        if (!query) {
          return cbk([400, 'QueryExpectedToFindRecord']);
        }

        return cbk();
      },

      // Get graph
      getGraph: ['validate', ({}, cbk) => getNetworkGraph({lnd}, cbk)],

      // Payment
      getPayment: ['validate', ({}, cbk) => {
        if (query.length !== standardIdHexLength) {
          return cbk(null, {});
        }

        return getPayment({lnd, id: query}, cbk);
      }],

      // Records
      records: ['getGraph', 'getPayment', ({getGraph, getPayment}, cbk) => {
        const nodes = getGraph.nodes
          .filter(node => {
            if (node.alias.toLowerCase().includes(query.toLowerCase())) {
              return true;
            }

            return node.public_key === query;
          })
          .map(node => {
            return {
              alias: node.alias,
              capacity: asBigUnit(getGraph.channels.reduce(
                (sum, {capacity, policies}) => {
                  if (!policies.find(n => n.public_key === node.public_key)) {
                    return sum;
                  }

                  return sum + capacity;
                },
                Number()
              )),
              public_key: node.public_key,
              updated: moment(node.updated_at).fromNow(),
              urls: node.sockets.map(socket => `${node.public_key}@${socket}`),
            }
          })
          .filter(node => node.capacity !== asBigUnit(0));

        const channels = getGraph.channels
          .filter(channel => {
            try {
              if (channel.id === chanFormat({number: query}).channel) {
                return true;
              }
            } catch (err) {}

            return channel.id === query;
          })
          .map(channel => {
            return {
              capacity: channel.capacity,
              id: channel.id,
              policies: channel.policies.map(policy => {
                const node = getGraph.nodes
                  .find(n => n.public_key === policy.public_key);

                return {
                  alias: !node ? undefined : node.alias,
                  base_fee_mtokens: policy.base_fee_mtokens,
                  cltv_delta: policy.cltv_delta,
                  fee_rate: policy.fee_rate,
                  is_disabled: policy.is_disabled,
                  max_htlc_mtokens: policy.max_htlc_mtokens,
                  min_htlc_mtokens: policy.min_htlc_mtokens,
                  public_key: policy.public_key,
                };
              }),
              transaction_id: channel.transaction_id,
              transaction_vout: channel.transaction_vout,
              updated_at: channel.updated_at,
            };
          });

        return cbk(null, {
          channels: !!channels.length ? channels : undefined,
          nodes: !!nodes.length ? nodes : undefined,
          payment: getPayment.payment || undefined,
          payment_failed: getPayment.failed || undefined,
          payment_pending: getPayment.is_pending || undefined,
        });
      }],
    },
    returnResult({reject, resolve, of :'records'}, cbk));
  });
};
