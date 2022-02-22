import { near, log, BigInt, json, JSONValueKind } from "@graphprotocol/graph-ts";
import { NftMint, 
  NftCreateSerie, 
  Royalty, 
  NftBuy, 
  NftSetSeriesPrice, 
  NftOnApprove,
  NftTransferPayout,
  NftDecreaseSeriesCopy,
  NftTransfer,
  NftMintBatch } from "../generated/schema";

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  
  for (let i = 0; i < actions.length; i++) {
    handleAction(
      actions[i], 
      receipt.receipt, 
      receipt.block.header,
      receipt.outcome,
      receipt.receipt.signerPublicKey
      )
  }
}

function handleAction(
  action: near.ActionValue,
  receipt: near.ActionReceipt,
  blockHeader: near.BlockHeader,
  outcome: near.ExecutionOutcome,
  publicKey: near.PublicKey
): void {
  
  if (action.kind != near.ActionKind.FUNCTION_CALL) {
    log.info("Early return: {}", ["Not a function call"])
    return
  }
  
  const functionCall = action.toFunctionCall();
  
  // change the methodName here to the methodName emitting the log in the contract
  if (functionCall.methodName == "nft_mint") {
      const receiptId = receipt.id.toBase58()
      // Maps the JSON formatted log to the LOG entity
      let mints = new NftMint(`${receiptId}`)

      // Standard receipt properties
      mints.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
      mints.blockHeight = BigInt.fromU64(blockHeader.height)
      mints.blockHash = blockHeader.hash.toBase58()
      mints.predecessorId = receipt.predecessorId
      mints.receiverId = receipt.receiverId
      mints.signerId = receipt.signerId
      mints.signerPublicKey = publicKey.bytes.toBase58()
      mints.gasBurned = BigInt.fromU64(outcome.gasBurnt)
      mints.tokensBurned = outcome.tokensBurnt
      mints.outcomeId = outcome.id.toBase58()
      mints.executorId = outcome.executorId
      mints.outcomeBlockHash = outcome.blockHash.toBase58()

      // Log Parsing
      if(outcome.logs !=null && outcome.logs.length > 0){
     
        if(outcome.logs[0].split(':')[0] == 'EVENT_JSON'){

          // this part is required to turn the paras contract EVENT_JSON into valid JSON
          let delimiter = ':'
          let parts = outcome.logs[0].split(delimiter)
          parts[0] = '"EVENT_JSON"'
          let newString = parts.join(delimiter)
          let formatString = '{'+newString+'}'
          let parsed = json.fromString(formatString)

          
          if(parsed.kind == JSONValueKind.OBJECT){
            let entry = parsed.toObject()

            //EVENT_JSON
            let eventJSON = entry.entries[0].value.toObject()

            //standard, version, event (these stay the same for a NEP 171 emmitted log)
            for(let i = 0; i < eventJSON.entries.length; i++){
              let key = eventJSON.entries[i].key.toString()
              switch (true) {
                case key == 'standard':
                  mints.standard = eventJSON.entries[i].value.toString()
                  break
                case key == 'event':
                  mints.event = eventJSON.entries[i].value.toString()
                  break
                case key == 'version':
                  mints.version = eventJSON.entries[i].value.toString()
                  break
                case key == 'data':
                  let j = 0
                  let dataArray = eventJSON.entries[i].value.toArray()
                  while(j < dataArray.length){
                    let dataObject = dataArray[j].toObject()
                    for(let k = 0; k < dataObject.entries.length; k++){
                      let key = dataObject.entries[k].key.toString()
                      switch (true) {
                        case key == 'owner_id':
                          mints.owner_id = dataObject.entries[k].value.toString()
                          break
                        case key == 'token_ids':
                          let tokenArray = dataObject.entries[k].value.toArray()
                          let m = 0
                          while (m < tokenArray.length){
                            let tokenString = "none"
                            if(tokenArray[m].toString().length > 0){
                              tokenString = tokenArray[m].toString()
                              mints.token_series_id = tokenString.split(':')[0]
                              mints.token_id = tokenString.split(':')[1]
                            }
                            m++
                          }
                          break
                      }
                    }
                    j++
                  }
                  break
              }
            }
          }
          mints.save()
        }
        if(outcome.logs[0].split(':')[0] == '{"type"'){
          let parsed = json.fromString(outcome.logs[0])
          if(parsed.kind == JSONValueKind.OBJECT){

            let entry = parsed.toObject()

            
            // Standard receipt properties
            mints.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
            mints.blockHeight = BigInt.fromU64(blockHeader.height)
            mints.blockHash = blockHeader.hash.toBase58()
            mints.predecessorId = receipt.predecessorId
            mints.receiverId = receipt.receiverId
            mints.signerId = receipt.signerId
            mints.signerPublicKey = publicKey.bytes.toBase58()
            mints.gasBurned = BigInt.fromU64(outcome.gasBurnt)
            mints.tokensBurned = outcome.tokensBurnt
            mints.outcomeId = outcome.id.toBase58()
            mints.executorId = outcome.executorId
            mints.outcomeBlockHash = outcome.blockHash.toBase58()

            // types JSON
            // paras had some non-NEP 171 logs early on
            for(let i = 0; i < entry.entries.length; i++){
              let key = entry.entries[i].key.toString()
              switch (true) {
                case key == 'type':
                  mints.type = entry.entries[i].value.toString()
                  break
                case key == 'params':
                  let paramObject = entry.entries[i].value.toObject()
                  for(let m = 0; m < paramObject.entries.length; m++){
                    let key = paramObject.entries[m].key.toString()
                    switch (true) {
                      case key == 'token_id':
                        let tokenString = paramObject.entries[m].value.toString()
                        mints.token_series_id = tokenString.split(':')[0]
                        mints.token_id = tokenString.split(':')[1]
                        break
                      case key == 'sender_id':
                        mints.sender_id = paramObject.entries[m].value.toString()
                        break
                      case key == 'receiver_id':
                        mints.receive_id = paramObject.entries[m].value.toString()
                        break
                    }
                  }
              }
            }
          }
          mints.save()
        }
      }
      
  } else {
    log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
  }

  // change the methodName here to the methodName emitting the log in the contract
  if (functionCall.methodName == "nft_buy") {
    const receiptId = receipt.id.toBase58()
    // Maps the JSON formatted log to the LOG entity
    let mints = new NftBuy(`${receiptId}`)

    // Standard receipt properties
    mints.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
    mints.blockHeight = BigInt.fromU64(blockHeader.height)
    mints.blockHash = blockHeader.hash.toBase58()
    mints.predecessorId = receipt.predecessorId
    mints.receiverId = receipt.receiverId
    mints.signerId = receipt.signerId
    mints.signerPublicKey = publicKey.bytes.toBase58()
    mints.gasBurned = BigInt.fromU64(outcome.gasBurnt)
    mints.tokensBurned = outcome.tokensBurnt
    mints.outcomeId = outcome.id.toBase58()
    mints.executorId = outcome.executorId
    mints.outcomeBlockHash = outcome.blockHash.toBase58()

    // Log Parsing
    if(outcome.logs !=null && outcome.logs.length > 0){
   
      if(outcome.logs[0].split(':')[0] == 'EVENT_JSON'){

        // this part is required to turn the paras contract EVENT_JSON into valid JSON
        let delimiter = ':'
        let parts = outcome.logs[0].split(delimiter)
        parts[0] = '"EVENT_JSON"'
        let newString = parts.join(delimiter)
        let formatString = '{'+newString+'}'
        let parsed = json.fromString(formatString)

        
        if(parsed.kind == JSONValueKind.OBJECT){
          let entry = parsed.toObject()

          //EVENT_JSON
          let eventJSON = entry.entries[0].value.toObject()

          //standard, version, event (these stay the same for a NEP 171 emmitted log)
          for(let i = 0; i < eventJSON.entries.length; i++){
            let key = eventJSON.entries[i].key.toString()
            switch (true) {
              case key == 'standard':
                mints.standard = eventJSON.entries[i].value.toString()
                break
              case key == 'event':
                mints.event = eventJSON.entries[i].value.toString()
                break
              case key == 'version':
                mints.version = eventJSON.entries[i].value.toString()
                break
              case key == 'data':
                let j = 0
                let dataArray = eventJSON.entries[i].value.toArray()
                while(j < dataArray.length){
                  let dataObject = dataArray[j].toObject()
                  for(let k = 0; k < dataObject.entries.length; k++){
                    let key = dataObject.entries[k].key.toString()
                    switch (true) {
                      case key == 'owner_id':
                        mints.owner_id = dataObject.entries[k].value.toString()
                        break
                      case key == 'token_ids':
                        let tokenArray = dataObject.entries[k].value.toArray()
                        let m = 0
                        while (m < tokenArray.length){
                          let tokenString = "none"
                          if(tokenArray[m].toString().length > 0){
                            tokenString = tokenArray[m].toString()
                            mints.token_series_id = tokenString.split(':')[0]
                            mints.token_id = tokenString.split(':')[1]
                          }
                          m++
                        }
                        break
                      case key == 'memo':
                        mints.memo = dataObject.entries[k].value.toString()
                        break
                    }
                  }
                  j++
                }
                break
            }
          }
        }
        mints.save()
      }
    }
    
} else {
  log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
}

  // change the methodName here to the methodName emitting the log in the contract
  if (functionCall.methodName == "nft_create_series") {
    const receiptId = receipt.id.toBase58()
    log.info('outcome log here is: {}', [outcome.logs[0]])
    if(outcome.logs !=null && outcome.logs.length > 0){
      for(let x = 0; x < outcome.logs.length; x++){
        // Maps the JSON formatted log
        let series = new NftCreateSerie(`${receiptId}-${x}`)

        // Standard receipt properties
        series.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
        series.blockHeight = BigInt.fromU64(blockHeader.height)
        series.blockHash = blockHeader.hash.toBase58()
        series.predecessorId = receipt.predecessorId
        series.receiverId = receipt.receiverId
        series.signerId = receipt.signerId
        series.signerPublicKey = publicKey.bytes.toBase58()
        series.gasBurned = BigInt.fromU64(outcome.gasBurnt)
        series.tokensBurned = outcome.tokensBurnt
        series.outcomeId = outcome.id.toBase58()
        series.executorId = outcome.executorId
        series.outcomeBlockHash = outcome.blockHash.toBase58()
        series.log = outcome.logs[x]

        // Log Parsing
       
        let parsed = json.fromString(outcome.logs[x])
        if(parsed.kind == JSONValueKind.OBJECT){

          let entry = parsed.toObject()

          // types JSON
          // paras had some non-NEP 171 logs early on
          for(let i = 0; i < entry.entries.length; i++){
            let key = entry.entries[i].key.toString()
            switch (true) {
              case key == 'type':
                series.type = entry.entries[i].value.toString()
                break
              case key == 'params':
                if(entry.entries[i].value.kind == JSONValueKind.OBJECT){
                  let paramObject = entry.entries[i].value.toObject()
                  for(let m = 0; m < paramObject.entries.length; m++){
                    let paramKey = paramObject.entries[m].key.toString()
                    switch (true) {
                      case paramKey == 'token_series_id':
                        series.token_series_id = paramObject.entries[m].value.toString()
                        break
                      case paramKey == 'token_metadata':
                          if(paramObject.entries[m].value.kind == JSONValueKind.OBJECT){
                            let metaObject = paramObject.entries[m].value.toObject()
                            for(let j = 0; j < metaObject.entries.length; j++){
                              let metaKey = metaObject.entries[j].key.toString()
                              switch (true) {
                                case metaKey == 'title':
                                  series.title = metaObject.entries[j].value.kind != JSONValueKind.NULL ? metaObject.entries[j].value.toString() : null
                                  break
                                case metaKey == 'description':
                                  series.description = metaObject.entries[j].value.kind != JSONValueKind.NULL ? metaObject.entries[j].value.toString() : null
                                  break
                                case metaKey == 'media':
                                  series.media = metaObject.entries[j].value.kind != JSONValueKind.NULL ? metaObject.entries[j].value.toString() : null
                                  break
                                case metaKey == 'media_hash':
                                  series.media_hash = metaObject.entries[j].value.kind != JSONValueKind.NULL ? metaObject.entries[j].value.toString() : null
                                  break
                                case metaKey == 'copies':
                                  series.copies = metaObject.entries[j].value.kind != JSONValueKind.NULL && metaObject.entries[j].value.kind == JSONValueKind.NUMBER ? metaObject.entries[j].value.toBigInt() 
                                  : metaObject.entries[j].value.kind != JSONValueKind.NULL && metaObject.entries[j].value.kind == JSONValueKind.STRING ? BigInt.fromString(metaObject.entries[j].value.toString()) : null
                                  break
                                case metaKey == 'issued_at':
                                  series.issued_at = metaObject.entries[j].value.kind != JSONValueKind.NULL ? metaObject.entries[j].value.toBigInt() : null
                                  break
                                case metaKey == 'expires_at':
                                  series.expires_at = metaObject.entries[j].value.kind != JSONValueKind.NULL ? metaObject.entries[j].value.toBigInt() : null
                                  break
                                case metaKey == 'starts_at':
                                  series.starts_at = metaObject.entries[j].value.kind != JSONValueKind.NULL ? metaObject.entries[j].value.toBigInt() : null
                                  break
                                case metaKey == 'updated_at':
                                  series.updated_at = metaObject.entries[j].value.kind != JSONValueKind.NULL ? metaObject.entries[j].value.toBigInt() : null
                                  break
                                case metaKey == 'extra':
                                  series.extra = metaObject.entries[j].value.kind != JSONValueKind.NULL ? metaObject.entries[j].value.toString() : null
                                  break
                                case metaKey == 'reference':
                                  series.reference = metaObject.entries[j].value.kind != JSONValueKind.NULL ? metaObject.entries[j].value.toString() : null
                                  break
                                case metaKey == 'reference_hash':
                                  series.reference_hash = metaObject.entries[j].value.kind != JSONValueKind.NULL ? metaObject.entries[j].value.toString() : null
                                  break
                              }
                            }
                          }
                        break
                      case paramKey == 'creator_id':
                        series.creator_id = paramObject.entries[m].value.kind != JSONValueKind.NULL ? paramObject.entries[m].value.toString() : null
                        break
                      case paramKey == 'price':
                        series.price = paramObject.entries[m].value.kind != JSONValueKind.NULL ? BigInt.fromString(paramObject.entries[m].value.toString()) : null
                        break
                      case paramKey == 'royalty':
                        if(paramObject.entries[m].value.kind == JSONValueKind.OBJECT){
                          let royaltyObject = paramObject.entries[m].value.toObject()
                          for(let p = 0; p < royaltyObject.entries.length; p++){
                            let royalties = new Royalty(`${receiptId}-${p}`)
                            royalties.account = royaltyObject.entries[p].key.toString()
                            royalties.amount = royaltyObject.entries[p].value.toBigInt()
                            royalties.save()
                            series.royalties = royalties.id
                          }
                        } 
                        break
                    }
                  }
                }
              break
            }
          }
          series.save()
        }
      }
    }
  } else {
    log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
  }

  // change the methodName here to the methodName emitting the log in the contract
  if (functionCall.methodName == "nft_set_series_price") {
    const receiptId = receipt.id.toBase58()
    // Maps the JSON formatted log
    let series = new NftSetSeriesPrice(`${receiptId}`)

    // Standard receipt properties
    series.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
    series.blockHeight = BigInt.fromU64(blockHeader.height)
    series.blockHash = blockHeader.hash.toBase58()
    series.predecessorId = receipt.predecessorId
    series.receiverId = receipt.receiverId
    series.signerId = receipt.signerId
    series.signerPublicKey = publicKey.bytes.toBase58()
    series.gasBurned = BigInt.fromU64(outcome.gasBurnt)
    series.tokensBurned = outcome.tokensBurnt
    series.outcomeId = outcome.id.toBase58()
    series.executorId = outcome.executorId
    series.outcomeBlockHash = outcome.blockHash.toBase58()
    series.log = outcome.logs[0]

    // Log Parsing
    if(outcome.logs !=null && outcome.logs.length > 0){
        let parsed = json.fromString(outcome.logs[0])
        if(parsed.kind == JSONValueKind.OBJECT){

          let entry = parsed.toObject()

          // types JSON
          // paras had some non-NEP 171 logs early on
          for(let i = 0; i < entry.entries.length; i++){
            let key = entry.entries[i].key.toString()
            switch (true) {
              case key == 'type':
                series.type = entry.entries[i].value.toString()
                break
              case key == 'params':
                if(entry.entries[i].value.kind == JSONValueKind.OBJECT){
                  let paramObject = entry.entries[i].value.toObject()
                  for(let m = 0; m < paramObject.entries.length; m++){
                    let paramKey = paramObject.entries[m].key.toString()
                    switch (true) {
                      case paramKey == 'token_series_id':
                        series.token_series_id = paramObject.entries[m].value.toString()
                        break
                      case paramKey == 'price':
                        series.price = paramObject.entries[m].value.kind != JSONValueKind.NULL ? BigInt.fromString(paramObject.entries[m].value.toString()) : null
                        break
                    }
                  }
                }
              break
            }
          }
        series.save()
      }
    }
    
  } else {
    log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
  }

  // change the methodName here to the methodName emitting the log in the contract
  if (functionCall.methodName == "nft_on_approve") {
    const receiptId = receipt.id.toBase58()
    // Maps the JSON formatted log
    let series = new NftOnApprove(`${receiptId}`)

    // Standard receipt properties
    series.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
    series.blockHeight = BigInt.fromU64(blockHeader.height)
    series.blockHash = blockHeader.hash.toBase58()
    series.predecessorId = receipt.predecessorId
    series.receiverId = receipt.receiverId
    series.signerId = receipt.signerId
    series.signerPublicKey = publicKey.bytes.toBase58()
    series.gasBurned = BigInt.fromU64(outcome.gasBurnt)
    series.tokensBurned = outcome.tokensBurnt
    series.outcomeId = outcome.id.toBase58()
    series.executorId = outcome.executorId
    series.outcomeBlockHash = outcome.blockHash.toBase58()
    series.log = outcome.logs[0]

    // Log Parsing
    if(outcome.logs !=null && outcome.logs.length > 0){
        let parsed = json.fromString(outcome.logs[0])
        if(parsed.kind == JSONValueKind.OBJECT){

          let entry = parsed.toObject()

          // types JSON
          // paras had some non-NEP 171 logs early on
          for(let i = 0; i < entry.entries.length; i++){
            let key = entry.entries[i].key.toString()
            switch (true) {
              case key == 'type':
                series.type = entry.entries[i].value.toString()
                break
              case key == 'params':
                if(entry.entries[i].value.kind == JSONValueKind.OBJECT){
                  let paramObject = entry.entries[i].value.toObject()
                  for(let m = 0; m < paramObject.entries.length; m++){
                    let paramKey = paramObject.entries[m].key.toString()
                    switch (true) {
                      case paramKey == 'owner_id':
                        series.owner_id = paramObject.entries[m].value.toString()
                        break
                      case paramKey == 'approval_id':
                        series.approval_id = paramObject.entries[m].value.toString()
                        break
                      case paramKey == 'nft_contract_id':
                        series.nft_contract_id = paramObject.entries[m].value.toString()
                        break
                      case key == 'token_id':
                        let tokenArray = paramObject.entries[m].value.toArray()
                        let n = 0
                        while (n < tokenArray.length){
                          let tokenString = "none"
                          if(tokenArray[n].toString().length > 0){
                            tokenString = tokenArray[n].toString()
                            series.token_series_id = tokenString.split(':')[0]
                            series.token_id = tokenString.split(':')[1]
                          }
                          m++
                        }
                        break
                      case paramKey == 'ft_token_id':
                        series.owner_id = paramObject.entries[m].value.toString()
                        break
                      case paramKey == 'price':
                        series.price = paramObject.entries[m].value.kind != JSONValueKind.NULL ? BigInt.fromString(paramObject.entries[m].value.toString()) : null
                        break
                      case paramKey == 'started_at':
                        series.started_at = paramObject.entries[m].value.kind != JSONValueKind.NULL ? paramObject.entries[m].value.toBigInt() : null
                        break
                      case paramKey == 'ended_at':
                        series.ended_at = paramObject.entries[m].value.kind != JSONValueKind.NULL ? paramObject.entries[m].value.toBigInt() : null
                        break
                      case paramKey == 'end_price':
                        series.end_price = paramObject.entries[m].value.kind != JSONValueKind.NULL ? BigInt.fromString(paramObject.entries[m].value.toString()) : null
                        break
                      case paramKey == 'is_auction':
                        series.is_auction = paramObject.entries[m].value.toBool()
                        break
                    }
                  }
                }
              break
            }
          }
        series.save()
      }
    }
    
  } else {
    log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
  }

  // change the methodName here to the methodName emitting the log in the contract
  if (functionCall.methodName == "nft_transfer_payout") {
    const receiptId = receipt.id.toBase58()
    // Maps the JSON formatted log to the LOG entity
    let mints = new NftTransferPayout(`${receiptId}`)

    // Standard receipt properties
    mints.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
    mints.blockHeight = BigInt.fromU64(blockHeader.height)
    mints.blockHash = blockHeader.hash.toBase58()
    mints.predecessorId = receipt.predecessorId
    mints.receiverId = receipt.receiverId
    mints.signerId = receipt.signerId
    mints.signerPublicKey = publicKey.bytes.toBase58()
    mints.gasBurned = BigInt.fromU64(outcome.gasBurnt)
    mints.tokensBurned = outcome.tokensBurnt
    mints.outcomeId = outcome.id.toBase58()
    mints.executorId = outcome.executorId
    mints.outcomeBlockHash = outcome.blockHash.toBase58()

    // Log Parsing
    if(outcome.logs !=null && outcome.logs.length > 0){
   
      if(outcome.logs[1].split(':')[0] == 'EVENT_JSON'){

        // this part is required to turn the paras contract EVENT_JSON into valid JSON
        let delimiter = ':'
        let parts = outcome.logs[1].split(delimiter)
        parts[0] = '"EVENT_JSON"'
        let newString = parts.join(delimiter)
        let formatString = '{'+newString+'}'
        let parsed = json.fromString(formatString)

        
        if(parsed.kind == JSONValueKind.OBJECT){
          let entry = parsed.toObject()

          //EVENT_JSON
          let eventJSON = entry.entries[0].value.toObject()

          //standard, version, event (these stay the same for a NEP 171 emmitted log)
          for(let i = 0; i < eventJSON.entries.length; i++){
            let key = eventJSON.entries[i].key.toString()
            switch (true) {
              case key == 'standard':
                mints.standard = eventJSON.entries[i].value.toString()
                break
              case key == 'event':
                mints.event = eventJSON.entries[i].value.toString()
                break
              case key == 'version':
                mints.version = eventJSON.entries[i].value.toString()
                break
              case key == 'data':
                let j = 0
                let dataArray = eventJSON.entries[i].value.toArray()
                while(j < dataArray.length){
                  let dataObject = dataArray[j].toObject()
                  for(let k = 0; k < dataObject.entries.length; k++){
                    let key = dataObject.entries[k].key.toString()
                    switch (true) {
                      case key == 'authorized_id':
                        mints.authorized_id = dataObject.entries[k].value.toString()
                        break
                      case key == 'old_owner_id':
                        mints.old_owner_id = dataObject.entries[k].value.toString()
                        break
                      case key == 'new_owner_id':
                        mints.new_owner_id = dataObject.entries[k].value.toString()
                        break
                      case key == 'token_ids':
                        let tokenArray = dataObject.entries[k].value.toArray()
                        let m = 0
                        while (m < tokenArray.length){
                          let tokenString = "none"
                          if(tokenArray[m].toString().length > 0){
                            tokenString = tokenArray[m].toString()
                            mints.token_series_id = tokenString.split(':')[0]
                            mints.token_id = tokenString.split(':')[1]
                          }
                          m++
                        }
                        break
                    }
                  }
                  j++
                }
                break
            }
          }
        }
        mints.save()
      }
    }
    
} else {
  log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
}

  // change the methodName here to the methodName emitting the log in the contract
  if (functionCall.methodName == "nft_decrease_series_copies") {
    const receiptId = receipt.id.toBase58()
    // Maps the JSON formatted log
    let series = new NftDecreaseSeriesCopy(`${receiptId}`)

    // Standard receipt properties
    series.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
    series.blockHeight = BigInt.fromU64(blockHeader.height)
    series.blockHash = blockHeader.hash.toBase58()
    series.predecessorId = receipt.predecessorId
    series.receiverId = receipt.receiverId
    series.signerId = receipt.signerId
    series.signerPublicKey = publicKey.bytes.toBase58()
    series.gasBurned = BigInt.fromU64(outcome.gasBurnt)
    series.tokensBurned = outcome.tokensBurnt
    series.outcomeId = outcome.id.toBase58()
    series.executorId = outcome.executorId
    series.outcomeBlockHash = outcome.blockHash.toBase58()
    series.log = outcome.logs[0]

    // Log Parsing
    if(outcome.logs !=null && outcome.logs.length > 0){
        let parsed = json.fromString(outcome.logs[0])
        if(parsed.kind == JSONValueKind.OBJECT){

          let entry = parsed.toObject()

          // types JSON
          // paras had some non-NEP 171 logs early on
          for(let i = 0; i < entry.entries.length; i++){
            let key = entry.entries[i].key.toString()
            switch (true) {
              case key == 'type':
                series.type = entry.entries[i].value.toString()
                break
              case key == 'params':
                if(entry.entries[i].value.kind == JSONValueKind.OBJECT){
                  let paramObject = entry.entries[i].value.toObject()
                  for(let m = 0; m < paramObject.entries.length; m++){
                    let paramKey = paramObject.entries[m].key.toString()
                    switch (true) {
                      case paramKey == 'token_series_id':
                        series.token_series_id = paramObject.entries[m].value.toString()
                        break
                      case paramKey == 'copies':
                        series.copies = paramObject.entries[m].value.kind != JSONValueKind.NULL && paramObject.entries[m].value.kind == JSONValueKind.NUMBER ? paramObject.entries[m].value.toBigInt() 
                        : paramObject.entries[m].value.kind != JSONValueKind.NULL && paramObject.entries[m].value.kind == JSONValueKind.STRING ? BigInt.fromString(paramObject.entries[m].value.toString()) : null
                        break
                      case paramKey == 'is_non_mintable':
                        series.is_non_mintable = paramObject.entries[m].value.toBool()
                        break
                    }
                  }
                }
              break
            }
          }
        series.save()
      }
    }
    
  } else {
    log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
  }

  // change the methodName here to the methodName emitting the log in the contract
  if (functionCall.methodName == "nft_mint_batch") {
    const receiptId = receipt.id.toBase58()
    // Maps the JSON formatted log
    log.info('outcome logs is {}', [outcome.logs[0]])
    if(outcome.logs !=null && outcome.logs.length > 0){
      for(let x = 0; x < outcome.logs.length; x++){
        let series = new NftMintBatch(`${receiptId}-${x}`)

        // Standard receipt properties
        series.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
        series.blockHeight = BigInt.fromU64(blockHeader.height)
        series.blockHash = blockHeader.hash.toBase58()
        series.predecessorId = receipt.predecessorId
        series.receiverId = receipt.receiverId
        series.signerId = receipt.signerId
        series.signerPublicKey = publicKey.bytes.toBase58()
        series.gasBurned = BigInt.fromU64(outcome.gasBurnt)
        series.tokensBurned = outcome.tokensBurnt
        series.outcomeId = outcome.id.toBase58()
        series.executorId = outcome.executorId
        series.outcomeBlockHash = outcome.blockHash.toBase58()
        series.log = outcome.logs[x]

        // Log Parsing
        
          
        let parsed = json.fromString(outcome.logs[x])
        if(parsed.kind == JSONValueKind.OBJECT){

          let entry = parsed.toObject()

          // types JSON
          // paras had some non-NEP 171 logs early on
          for(let i = 0; i < entry.entries.length; i++){
            let key = entry.entries[i].key.toString()
            switch (true) {
              case key == 'type':
                series.type = entry.entries[i].value.toString()
                break
              case key == 'params':
                if(entry.entries[i].value.kind == JSONValueKind.OBJECT){
                  let paramObject = entry.entries[i].value.toObject()
                  for(let m = 0; m < paramObject.entries.length; m++){
                    let paramKey = paramObject.entries[m].key.toString()
                    switch (true) {
                      case paramKey == 'token_id':
                        series.token_series_id = paramObject.entries[m].value.toString().split(':')[0]
                        series.token_id = paramObject.entries[m].value.toString().split(':')[1]
                        break
                      case paramKey == 'sender_id':
                        series.sender_id = paramObject.entries[m].value.toString()
                        break
                      case paramKey == 'receiver_id':
                        series.receive_id = paramObject.entries[m].value.toString()
                        break
                    }
                  }
                }
              break
            }
          }
        }
        series.save()
      }
    }
  } else {
    log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
  }

  // change the methodName here to the methodName emitting the log in the contract
  if (functionCall.methodName == "nft_transfer") {
    const receiptId = receipt.id.toBase58()
    // Maps the JSON formatted log to the LOG entity
    let mints = new NftTransfer(`${receiptId}`)

    // Standard receipt properties
    mints.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
    mints.blockHeight = BigInt.fromU64(blockHeader.height)
    mints.blockHash = blockHeader.hash.toBase58()
    mints.predecessorId = receipt.predecessorId
    mints.receiverId = receipt.receiverId
    mints.signerId = receipt.signerId
    mints.signerPublicKey = publicKey.bytes.toBase58()
    mints.gasBurned = BigInt.fromU64(outcome.gasBurnt)
    mints.tokensBurned = outcome.tokensBurnt
    mints.outcomeId = outcome.id.toBase58()
    mints.executorId = outcome.executorId
    mints.outcomeBlockHash = outcome.blockHash.toBase58()

    // Log Parsing
    if(outcome.logs !=null && outcome.logs.length > 0){
   
      if(outcome.logs[1].split(':')[0] == 'EVENT_JSON'){

        // this part is required to turn the paras contract EVENT_JSON into valid JSON
        let delimiter = ':'
        let parts = outcome.logs[1].split(delimiter)
        parts[0] = '"EVENT_JSON"'
        let newString = parts.join(delimiter)
        let formatString = '{'+newString+'}'
        let parsed = json.fromString(formatString)

        
        if(parsed.kind == JSONValueKind.OBJECT){
          let entry = parsed.toObject()

          //EVENT_JSON
          let eventJSON = entry.entries[0].value.toObject()

          //standard, version, event (these stay the same for a NEP 171 emmitted log)
          for(let i = 0; i < eventJSON.entries.length; i++){
            let key = eventJSON.entries[i].key.toString()
            switch (true) {
              case key == 'standard':
                mints.standard = eventJSON.entries[i].value.toString()
                break
              case key == 'event':
                mints.event = eventJSON.entries[i].value.toString()
                break
              case key == 'version':
                mints.version = eventJSON.entries[i].value.toString()
                break
              case key == 'data':
                let j = 0
                let dataArray = eventJSON.entries[i].value.toArray()
                while(j < dataArray.length){
                  let dataObject = dataArray[j].toObject()
                  for(let k = 0; k < dataObject.entries.length; k++){
                    let key = dataObject.entries[k].key.toString()
                    switch (true) {
                      case key == 'old_owner_id':
                        mints.old_owner_id = dataObject.entries[k].value.toString()
                        break
                      case key == 'new_owner_id':
                        mints.new_owner_id = dataObject.entries[k].value.toString()
                        break
                      case key == 'token_ids':
                        let tokenArray = dataObject.entries[k].value.toArray()
                        let m = 0
                        while (m < tokenArray.length){
                          let tokenString = "none"
                          if(tokenArray[m].toString().length > 0){
                            tokenString = tokenArray[m].toString()
                            mints.token_series_id = tokenString.split(':')[0]
                            mints.token_id = tokenString.split(':')[1]
                          }
                          m++
                        }
                        break
                    }
                  }
                  j++
                }
                break
            }
          }
        }
        mints.save()
      }
    }
    
} else {
  log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
}
  
}
