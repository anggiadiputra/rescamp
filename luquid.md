# LIQUID API (DomainsAS / Liqu.id) Complete Documentation

**Base URLs:** `https://api.liqu.id/v1` | `https://api.domainsas.com/v1`  
**Authentication:** HTTP Basic Auth — `Username: Reseller ID`, `Password: API Key`  
**Official Docs:** `https://api.liqu.id/docs` (Swagger Specification: `https://api.liqu.id/json`)  
**Last Updated & Verified:** August 2026

---

## Overview

Dokumentasi ini berisi daftar lengkap endpoint LIQUID API yang diverifikasi langsung dari spesifikasi Swagger resmi (`https://api.liqu.id/json`). All form/query parameters, HTTP methods, and TLD eligibility rules are synchronized with the live API specification.

## Table of Contents

- **[1. Account Management (`/account`)]** — 4 endpoints
- **[2. Billing & Pricing (`/billing`)]** — 15 endpoints
- **[3. Common Utilities (`/common`)]** — 7 endpoints
- **[4. Contacts Management (`/contacts`)]** — 8 endpoints
- **[5. Customer Management (`/customers`)]** — 9 endpoints
- **[6. DNS Management (`/dns`)]** — 28 endpoints
- **[7. Domain Forwarding (`/domain-forwarding`)]** — 2 endpoints
- **[8. Domain Operations (`/domains`)]** — 39 endpoints
- **[9. Email Forwarding (`/email-forwarding`)]** — 7 endpoints
- **[10. Privacy Protection (`/privacy-protection`)]** — 4 endpoints
- **[11. Reseller Management (`/resellers`)]** — 8 endpoints

---

## 1. Account Management (`/account`)

### `GET https://api.domainsas.com/v1/account/balance`

**Summary:** retrieve account's balance  
**Description:** retrieve account's balance  

*No parameters required.*

---

### `GET https://api.domainsas.com/v1/account/prices`

**Summary:** list all prices applied for current account  
**Description:** List all Prices applied for Current Account.  

*No parameters required.*

---

### `GET https://api.domainsas.com/v1/account/transactions`

**Summary:** list all account's transactions  
**Description:** Gets a detailed list of the Current Account's Transactions.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `limit` | `integer` | `query` | No | Limit number of Transactions to be fetched. This should be a value between 10 to 100. |
| `page_no` | `integer` | `query` | No | Page number for which details are to be fetched |
| `transaction_type` | `string` | `query` | No | Type of the Transactions. Possible values can be domain, deposit, note, privacy_protect. |
| `transaction_id` | `string` | `query` | No | Transaction ID |
| `date_start` | `string` | `query` | No | UNIX TimeStamp for listing of Transactions whose Creation Date is greater than date_start. Value can be yyyy-mm-dd. |
| `date_end` | `string` | `query` | No | UNIX TimeStamp for listing of Transactions whose Creation Date is less than date_end. Value can be yyyy-mm-dd. |
| `amount_range_start` | `integer` | `query` | No | Lowest amount in the range of Transactions you intend to list |
| `amount_range_end` | `integer` | `query` | No | Highest amount in the range of Transactions you intend to list |
| `description` | `string` | `query` | No | Description transaction |

---

### `GET https://api.domainsas.com/v1/account/transactions/{transaction_id}`

**Summary:** retrieve an account's transactions  
**Description:** Gets an Account's Transactions along with their details.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `transaction_id` | `integer` | `path` | ✅ Yes | Transaction Ids of the Transactions whose details are to be fetched |

---

## 2. Billing & Pricing (`/billing`)

### `GET https://api.domainsas.com/v1/customers/{customer_id}/balance`

**Summary:** retrieve a customer's balance  
**Description:** Retrieves the Available Balance of the specified Customer.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of the Customer whose Available Balance is to be fetched |

---

### `GET https://api.domainsas.com/v1/customers/{customer_id}/transactions`

**Summary:** list all transactions of a customer  
**Description:** Gets a detailed list of the Customer's Transactions, matching the search criteria.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of the Customer |
| `limit` | `integer` | `query` | No | Limit number of Transactions to be fetched. This should be a value between 10 to 100. |
| `page_no` | `integer` | `query` | No | Page number for which details are to be fetched |
| `transaction_type` | `string` | `query` | No | Type of the Transactions. Possible values can be : domain, deposit, note, privacy_protect. |
| `transaction_id` | `string` | `query` | No | Transaction Ids : 1,2,3,4. |
| `date_start` | `string` | `query` | No | UNIX TimeStamp for listing of Transactions whose Creation Date is greater than date_start. Value can be yyyy-mm-dd. |
| `date_end` | `string` | `query` | No | UNIX TimeStamp for listing of Transactions whose Creation Date is less than date_end. Value can be yyyy-mm-dd. |
| `amount_range_start` | `integer` | `query` | No | Lowest amount in the range of Transactions you intend to list |
| `amount_range_end` | `integer` | `query` | No | Highest amount in the range of Transactions you intend to list |
| `description` | `string` | `query` | No | Description |
| `only_pending` | `boolean` | `query` | No | Show only pending transactions. can be filled with string true or false, 1 or 0 |

---

### `POST https://api.domainsas.com/v1/customers/{customer_id}/transactions/cancel`

**Summary:** cancel a customer's pending invoice  
**Description:** Cancel a Customer's transaction pending orderonly  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of Customer |
| `transaction_id` | `integer` | `form` | ✅ Yes | Transaction Ids of the Transactions which want to be canceled |

---

### `POST https://api.domainsas.com/v1/customers/{customer_id}/transactions/debit_note`

**Summary:** add debit note to a customer  
**Description:** Adds a Debit Note against Customer's Account.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of Customer against whom Debit Note is to be added |
| `amount` | `double` | `form` | ✅ Yes | Amount of Debit Note |
| `description` | `string` | `form` | ✅ Yes | Description for the Debit Note |
| `subtract_total_receipts` | `integer` | `form` | No | Subtract this Amount from Total Receipts figure of Customer. Value can be 1 or 0 |

---

### `POST https://api.domainsas.com/v1/customers/{customer_id}/transactions/execute`

**Summary:** execute a customer's pending Orderonly  
**Description:** Execute a Customer's transaction pending orderonly  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of Customer |
| `transaction_id` | `string` | `form` | ✅ Yes | Transaction Id(s) of the Transactions which want to be executed, comma separated. |
| `cancel_invoice` | `boolean` | `form` | ✅ Yes | true or false, 1 or 0 |

---

### `POST https://api.domainsas.com/v1/customers/{customer_id}/transactions/fund`

**Summary:** add fund to a customer  
**Description:** Adds funds in a Customer's Account.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of the Customer in whose Debit Account these funds are to be added |
| `amount` | `double` | `form` | ✅ Yes | Amount to be added |
| `description` | `string` | `form` | ✅ Yes | Description for the Transaction |

---

### `POST https://api.domainsas.com/v1/customers/{customer_id}/transactions/pay`

**Summary:** pay a customer's transaction keep invoice  
**Description:** Pay a Customer's transaction keep invoice  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of Customer |
| `transaction_id` | `string` | `form` | ✅ Yes | Transaction Id(s) of the Transactions which want to be pay, comma separated. |
| `subtract_balance` | `boolean` | `form` | ✅ Yes | Reduce customer balances string true or false |

---

### `POST https://api.domainsas.com/v1/customers/{customer_id}/transactions/pay_add_only`

**Summary:** pay a customer's transaction add only  
**Description:** Pay a Customer's transaction add only  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of Customer |
| `transaction_id` | `string` | `form` | ✅ Yes | Transaction Id(s) of the Transactions which want to be pay, comma separated. |

---

### `POST https://api.domainsas.com/v1/customers/{customer_id}/transactions/retry`

**Summary:** retry action pending  
**Description:** Retry action pending  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of Customer |
| `transaction_id` | `integer` | `form` | ✅ Yes | Transaction Id of the Transactions which want to be retry |

---

### `GET https://api.domainsas.com/v1/customers/{customer_id}/transactions/{transaction_id}`

**Summary:** retrieve a customer's transaction  
**Description:** Retrieves a Customer's Transactions along with their details.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of the Customer |
| `transaction_id` | `integer` | `path` | ✅ Yes | Transaction Ids of the Transactions whose details are to be fetched |

---

### `GET https://api.domainsas.com/v1/resellers/{reseller_id}/balance`

**Summary:** retrieve a sub reseller's balance  
**Description:** Gets the Available Balance of the specified Reseller.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `reseller_id` | `integer` | `path` | ✅ Yes | Reseller Id of the Reseller whose Available Balance is to be fetched |

---

### `GET https://api.domainsas.com/v1/resellers/{reseller_id}/transactions`

**Summary:** list all transactions of a sub reseller  
**Description:** Gets a detailed list of the Reseller's Transactions, matching the search criteria.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `reseller_id` | `integer` | `path` | ✅ Yes | Reseller Id of the Reseller whose Transactions are to be fetched |
| `limit` | `integer` | `query` | No | Limit number of Transactions to be fetched. This should be a value between 10 to 100. |
| `page_no` | `integer` | `query` | No | Page number for which details are to be fetched |
| `transaction_type` | `string` | `query` | No | Type of the Transactions. Possible values can be domain, deposit, note, privacy_protect. |
| `transaction_id` | `string` | `query` | No | Arrays of Transaction Ids : 1,2,3,4. |
| `date_start` | `string` | `query` | No | UNIX TimeStamp for listing of Transactions whose Creation Date is greater than date_start. Value can be yyyy-mm-dd. |
| `date_end` | `string` | `query` | No | UNIX TimeStamp for listing of Transactions whose Creation Date is less than date_end. Value can be yyyy-mm-dd. |
| `amount_range_start` | `integer` | `query` | No | Lowest amount in the range of Transactions you intend to list |
| `amount_range_end` | `integer` | `query` | No | Highest amount in the range of Transactions you intend to list |
| `description` | `string` | `query` | No | Description |
| `only_pending_customer` | `boolean` | `query` | No | Show only pending customer transactions. can be filled with string true or false, 1 or 0 |

---

### `POST https://api.domainsas.com/v1/resellers/{reseller_id}/transactions/debit_note`

**Summary:** add debit note to a sub reseller  
**Description:** add debit note to a sub reseller  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `reseller_id` | `integer` | `path` | ✅ Yes | Reseller ID |
| `amount` | `double` | `form` | ✅ Yes | Amount |
| `description` | `string` | `form` | ✅ Yes | Description |
| `subtract_total_receipts` | `integer` | `form` | No | Subtract this Amount from Total Receipts figure of Sub-Reseller. Value can be 1 or 0 |

---

### `POST https://api.domainsas.com/v1/resellers/{reseller_id}/transactions/fund`

**Summary:** add fund to a sub reseller  
**Description:** Adds funds in a Reseller's account.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `reseller_id` | `integer` | `path` | ✅ Yes | Reseller Id of the Reseller in whose Debit Account these funds are to be added |
| `amount` | `double` | `form` | ✅ Yes | Amount to be added |
| `description` | `string` | `form` | ✅ Yes | Description for the Transaction |

---

### `GET https://api.domainsas.com/v1/resellers/{reseller_id}/transactions/{transaction_id}`

**Summary:** retrieve a reseller's transaction  
**Description:** Gets a Reseller's Transactions along with their details.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `reseller_id` | `integer` | `path` | ✅ Yes | Reseller Id of the Reseller whose Transactions are to be fetched |
| `transaction_id` | `integer` | `path` | ✅ Yes | Transaction Ids of the Transactions whose details are to be fetched |

---

## 3. Common Utilities (`/common`)

### `GET https://api.domainsas.com/v1/agreements/{type}`

**Summary:** Get Legal Agreements  
**Description:** Get Legal Agreements  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `type` | `string` | `path` | ✅ Yes | resellermasteragreement, customermasteragreement, resellerdomainagreement, customerdomainagreement, resellerdigicertagreement, customerdigicertagreement, registraragreement |

---

### `GET https://api.domainsas.com/v1/countries`

**Summary:** retrieve all countries  
**Description:** Gets the list of Countries.  

*No parameters required.*

---

### `GET https://api.domainsas.com/v1/countries/{country_code}/states`

**Summary:** list all states in a country  
**Description:** Gets the list of States for a specified Country.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `country_code` | `string` | `path` | ✅ Yes | Country Code as per ISO 3166-1 alpha-2 : id, us, etc |

---

### `GET https://api.domainsas.com/v1/currencies`

**Summary:** list all currencies  
**Description:** Gets details of the supported Currencies.  

*No parameters required.*

---

### `GET https://api.domainsas.com/v1/currencies/{symbol}`

**Summary:** Get currency bay symbol  
**Description:** Get currency bay symbol  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `symbol` | `string` | `path` | ✅ Yes | Currency Symbol |

---

### `GET https://api.domainsas.com/v1/tlds`

**Summary:** list all tlds  
**Description:** Gets the list of TLDs.  

*No parameters required.*

---

### `GET https://api.domainsas.com/v1/tlds/{name}`

**Summary:** Get tld bay name  
**Description:** Get tld bay name  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `name` | `string` | `path` | ✅ Yes | Tld name |

---

## 4. Contacts Management (`/contacts`)

### `POST https://api.domainsas.com/v1/customers/{customer_id}/contacts`

**Summary:** create a new contact  
**Description:** Create a new Contact to the domain using the details provided.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | The Customer under whom you want to create the Contact |
| `name` | `string` | `form` | ✅ Yes | Name of the Contact |
| `company` | `string` | `form` | ✅ Yes | Name of the Company |
| `email` | `string` | `form` | ✅ Yes | Email address of the Contact |
| `address_line_1` | `string` | `form` | ✅ Yes | First line of address of the Contact |
| `address_line_2` | `string` | `form` | No | Second line of address of the Contact |
| `address_line_3` | `string` | `form` | No | Third line of address of the Contact |
| `city` | `string` | `form` | ✅ Yes | Name of the City |
| `country_code` | `string` | `form` | ✅ Yes | Country Code as per ISO 3166-1 alpha-2. </br> Example : id, us, gb, etc. |
| `state` | `string` | `form` | No | Name of the State |
| `zipcode` | `string` | `form` | ✅ Yes | Zip code |
| `tel_cc_no` | `string` | `form` | ✅ Yes | Telephone number Country Code |
| `tel_no` | `string` | `form` | ✅ Yes | Telephone number |
| `fax_cc_no` | `string` | `form` | No | Fax number Country Code |
| `fax_no` | `string` | `form` | No | Fax number |
| `eligibility_criteria` | `string` | `form` | No | The Eligibility Criteria. </br>This can take following values : mn, name, biz, us, co, in, cc, ca, com, bz, mobi, info, tv, org, net, pw, asia |
| `extra` | `string` | `form` | No | Extra information to be associated for the Contact. Example for us : us_purpose=business&us_category=citizen |

---

### `GET https://api.domainsas.com/v1/customers/{customer_id}/contacts`

**Summary:** list all contacts  
**Description:** List the Contact Details of the Contacts that match the Search criteria.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | The Customer for which you want to get the Contact Details |
| `limit` | `integer` | `query` | No | Limit number of Records to be returned. This should be a value between 10 to 100. |
| `page_no` | `integer` | `query` | No | Page Number for which records are required |
| `contact_id` | `string` | `query` | No | Array of Contact Ids for listing of specific Contacts. Example: 1,2,3,4 |
| `status` | `string` | `query` | No | List of Contact statuses. These can take any values from: InActive, Active, Suspended |
| `name` | `string` | `query` | No | Name of Contact |
| `company` | `string` | `query` | No | Name of the Company |
| `email` | `string` | `query` | No | Email address of the Contact |
| `eligibility_criteria` | `string` | `query` | No | The Eligibility Criteria. </br>This can take following values : mn, name, biz, us, co, in, cc, ca, com, bz, mobi, info, tv, org, net, pw, asia |
| `creation_date_start` | `string` | `query` | No | UNIX TimeStamp for listing of Customer accounts whose Creation Date is greater than creation_date_start. Value can be yyyy-mm-dd. |
| `creation_date_end` | `string` | `query` | No | UNIX TimeStamp for listing of Customer accounts whose Creation Date is less than creation_date_end. Value can be yyyy-mm-dd. |

---

### `GET https://api.domainsas.com/v1/customers/{customer_id}/contacts/default`

**Summary:** retrieve a customer's default contact  
**Description:** Retrieves the details of the Default Contacts for the Customer.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | The Customer for whom you want to fetch the default Name Servers. |
| `eligibility_criteria` | `string` | `query` | No | The Eligibility Criteria. </br>This can take following values : mn, name, biz, us, co, in, cc, ca, com, bz, mobi, info, tv, org, net, pw, asia. |

---

### `GET https://api.domainsas.com/v1/customers/{customer_id}/contacts/{contact_id}`

**Summary:** retrieve a contact  
**Description:** Retrieve the details for the specified Contact.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | The Customer under whom you want to Retrieve the Contact Details |
| `contact_id` | `integer` | `path` | ✅ Yes | The Contact Id for which details are required |

---

### `PUT https://api.domainsas.com/v1/customers/{customer_id}/contacts/{contact_id}`

**Summary:** update a contact  
**Description:** Updates the details of the specified Contact.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | The Customer under whom you want to update the Contact |
| `contact_id` | `integer` | `path` | ✅ Yes | Contact ID of the Contact whose details you want to modify |
| `name` | `string` | `form` | ✅ Yes | Name of Contact |
| `company` | `string` | `form` | ✅ Yes | Name of the Company |
| `email` | `string` | `form` | ✅ Yes | Email address of the Contact |
| `address_line_1` | `string` | `form` | ✅ Yes | First line of address of the Contact |
| `address_line_2` | `string` | `form` | No | Second line of address of the Contact |
| `address_line_3` | `string` | `form` | No | Third line of address of the Contact |
| `city` | `string` | `form` | ✅ Yes | Name of the City |
| `country_code` | `string` | `form` | ✅ Yes | Country code as per ISO 3166-1 alpha-2. </br>Example : id, us, gb, etc. |
| `state` | `string` | `form` | No | Name of the State |
| `zipcode` | `string` | `form` | ✅ Yes | ZIP code |
| `tel_cc_no` | `string` | `form` | ✅ Yes | Telephone number Country Code |
| `tel_no` | `string` | `form` | ✅ Yes | Telephone number |
| `fax_cc_no` | `string` | `form` | No | Fax number Country Code |
| `fax_no` | `string` | `form` | No | Fax number |

---

### `DELETE https://api.domainsas.com/v1/customers/{customer_id}/contacts/{contact_id}`

**Summary:** delete a contact  
**Description:** Deletes the specified Contact.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | The Customer under whom you want to update the Contact |
| `contact_id` | `integer` | `path` | ✅ Yes | The Contact that you want to delete |

---

### `PUT https://api.domainsas.com/v1/customers/{customer_id}/contacts/{contact_id}/extra`

**Summary:** update extra details of a contact  
**Description:** Update extra details with the specified Contact to register domain names under the TLDs : dotasia, dotca, dotcoop, dotes, dotjobs, dotnl, dotpro, dotru, dotus.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | The Customer under whom you want to update extra details of Contact |
| `contact_id` | `integer` | `path` | ✅ Yes | The Contact with which you want to associate extra details |
| `eligibility_criteria` | `string` | `form` | ✅ Yes | The Eligibility Criteria. </br>This can take following values : us, asia |
| `extra` | `string` | `form` | ✅ Yes | Array Extra Data. Extra information to be associated for the Contact. Example for us : us_purpose=business&us_category=citizen |

---

### `GET https://api.domainsas.com/v1/customers/{customer_id}/contacts/{contact_id}/validity/{eligibility_criteria}`

**Summary:** retrieve contact validity  
**Description:** Retrieve validates of the Registrant Contact(s) against the contact type(s) provided.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | The Customer under whom you want to retrieve the validity Contact |
| `contact_id` | `integer` | `path` | ✅ Yes | The Registrant Contact Id(s) which you want to validate |
| `eligibility_criteria` | `string` | `path` | ✅ Yes | To retrieve validity the Registrant Contact(s), pass the appropriate Eligibility Criteria that can take following values : mn, name, biz, us, co, in, cc, ca, com, bz, mobi, info, tv, org, net, pw, asia. |

---

## 5. Customer Management (`/customers`)

### `POST https://api.domainsas.com/v1/customers`

**Summary:** create a new customer  
**Description:** Creates a new Customer Account using the details provided.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `email` | `string` | `form` | ✅ Yes | Email address of the Customer |
| `name` | `string` | `form` | ✅ Yes | Name of the Customer |
| `password` | `string` | `form` | ✅ Yes | Password for the Customer account. |
| `company` | `string` | `form` | ✅ Yes | Name of the Customer's company |
| `address_line_1` | `string` | `form` | ✅ Yes | Address line 1 of the Customer's address |
| `address_line_2` | `string` | `form` | No | Address line 2 of the Customer's address |
| `address_line_3` | `string` | `form` | No | Address line 3 of the Customer's address |
| `city` | `string` | `form` | ✅ Yes | City |
| `state` | `string` | `form` | ✅ Yes | State. In case the State information is not available, you need to pass the value for this parameter as Not Applicable. |
| `country_code` | `string` | `form` | ✅ Yes | Country Code as per ISO 3166-1 alpha-2 |
| `zipcode` | `string` | `form` | ✅ Yes | ZIP code |
| `tel_cc_no` | `string` | `form` | ✅ Yes | Telephone number Country Code |
| `tel_no` | `string` | `form` | ✅ Yes | Telephone number |
| `alt_tel_cc_no` | `string` | `form` | No | Alternate Telephone number Country Code |
| `alt_tel_no` | `string` | `form` | No | Alternate Telephone number |
| `mobile_cc_no` | `string` | `form` | No | Mobile number Country Code |
| `mobile_no` | `string` | `form` | No | Mobile number |
| `fax_cc_no` | `string` | `form` | No | Fax number Country Code |
| `fax_no` | `string` | `form` | No | Fax number |

---

### `GET https://api.domainsas.com/v1/customers`

**Summary:** list all customers  
**Description:** Gets list details of the Customers that match the Search criteria.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `limit` | `integer` | `query` | No | Limit number of records to be fetched. This should be a value between 10 to 100. |
| `page_no` | `integer` | `query` | No | Page number for which details are to be fetched |
| `customer_id` | `string` | `query` | No | Customer Id(s) |
| `email` | `string` | `query` | No | Email address of the Customer |
| `name` | `string` | `query` | No | Name of Customer |
| `company` | `string` | `query` | No | Company name of Customer |
| `city` | `string` | `query` | No | City |
| `state` | `string` | `query` | No | State |
| `country_code` | `string` | `query` | No | Country Code |
| `status` | `string` | `query` | No | Status of Customer. Values can be Active and Suspended. |
| `creation_date_start` | `string` | `query` | No | UNIX TimeStamp for listing of Customer accounts whose Creation Date is greater than creation_date_start. Value can be yyyy-mm-dd. |
| `creation_date_end` | `string` | `query` | No | UNIX TimeStamp for listing of Customer accounts whose Creation Date is less than creation_date_end. Value can be yyyy-mm-dd. |
| `total_receipts_start` | `integer` | `query` | No | Total receipts of Customer which is greater than total_receipts_start |
| `total_receipts_end` | `integer` | `query` | No | Total receipts of Customer which is less than total_receipts_end |

---

### `GET https://api.domainsas.com/v1/customers/prices`

**Summary:** list all prices settings for customers  
**Description:** List all prices settings for Customers  

*No parameters required.*

---

### `GET https://api.domainsas.com/v1/customers/temp_password`

**Summary:** Generates a temporary password for the specified Customer.  
**Description:** Generates a temporary password for the specified Customer. The generated password is valid only for 3 days.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `query` | ✅ Yes | Customer Id of the Customer for whom a temporary password needs to be generated. |

---

### `PUT https://api.domainsas.com/v1/customers/totalreceipts`

**Summary:** update total receipts  
**Description:** Modifies Total Receipts of the specified Customer.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `form` | ✅ Yes | Customer Id of the Reseller for whom the details need to be modified |
| `totalreceipts` | `string` | `form` | ✅ Yes | New total receipts |

---

### `GET https://api.domainsas.com/v1/customers/{customer_id}`

**Summary:** retrieve a customer  
**Description:** Retrieves the Customer details for the specified Customer Id.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of the Customer |

---

### `PUT https://api.domainsas.com/v1/customers/{customer_id}`

**Summary:** update a customer  
**Description:** Updates the Account details of the specified Customer.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of the Customer whose details need to be modified |
| `email` | `string` | `form` | ✅ Yes | Email address of the Customer |
| `name` | `string` | `form` | ✅ Yes | Name of the Customer |
| `company` | `string` | `form` | ✅ Yes | Company name of the Customer |
| `address_line_1` | `string` | `form` | ✅ Yes | Address line 1 of the Customer's address |
| `address_line_2` | `string` | `form` | No | Address line 2 of the Customer's address |
| `address_line_3` | `string` | `form` | No | Address line 3 of the Customer's address |
| `city` | `string` | `form` | ✅ Yes | City |
| `state` | `string` | `form` | ✅ Yes | State. In case the State information is not available, you need to pass the value for this parameter as Not Applicable. |
| `country_code` | `string` | `form` | ✅ Yes | Country Code as per ISO 3166-1 alpha-2. </br> Example : id, us, gb, etc. |
| `zipcode` | `string` | `form` | ✅ Yes | ZIP code |
| `tel_cc_no` | `string` | `form` | ✅ Yes | Telephone number Country Code |
| `tel_no` | `string` | `form` | ✅ Yes | Telephone number |
| `alt_tel_cc_no` | `string` | `form` | No | Alternate Telephone Country Code |
| `alt_tel_no` | `string` | `form` | No | Alternate Telephone number |
| `mobile_cc_no` | `string` | `form` | No | Mobile number Country Code |
| `mobile_no` | `string` | `form` | No | Mobile number |
| `fax_cc_no` | `string` | `form` | No | Fax number Country Code |
| `fax_no` | `string` | `form` | No | Fax number |

---

### `DELETE https://api.domainsas.com/v1/customers/{customer_id}`

**Summary:** delete a customer  
**Description:** Deletes the specified Customer, if the Customer does not have any Active Order(s).  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | Customer Id of the Customer that you want to delete |

---

### `GET https://api.domainsas.com/v1/customers/{customer_id}/ns/default`

**Summary:** retrieve a customer's default ns  
**Description:** Retrieves the default Name Servers of the specified Customer.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `customer_id` | `integer` | `path` | ✅ Yes | The Customer for whom you want to fetch the default Name Servers. |

---

## 6. DNS Management (`/dns`)

### `POST https://api.domainsas.com/v1/domains/{domain_id}/dns/cname`

**Summary:** add a new canonical (CNAME) record of a domain  
**Description:** add a new canonical (CNAME) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `form` | No | Hostname, example namadomain102.com  |
| `value` | `string` | `form` | ✅ Yes | Value, Value for CNAME record should be a host/domainname/fqdn & not an IP Address |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/dns/cname`

**Summary:** list all canonical (CNAME) records of a domain  
**Description:** list all canonical (CNAME) records of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/dns/cname/{hostname}/{value}`

**Summary:** delete a canonical (CNAME) record of a domain  
**Description:** delete a canonical (CNAME) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `path` | ✅ Yes | Hostname |
| `value` | `string` | `path` | ✅ Yes | Value |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/dns/cname/{old_hostname}/{old_value}`

**Summary:** update a canonical (CNAME) record of a domain  
**Description:** update a canonical (CNAME) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `old_hostname` | `string` | `path` | ✅ Yes | Old Hostname |
| `old_value` | `string` | `path` | ✅ Yes | Old Value |
| `value` | `string` | `form` | ✅ Yes | New Value |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/dns/ip`

**Summary:** add a new ip address (A) record of a domain  
**Description:** add a new ip address (A) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `form` | No | Hostname |
| `value` | `string` | `form` | ✅ Yes | Value, example 203.168.176.23 |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/dns/ip`

**Summary:** list all ip address (A) records of a domain  
**Description:** list all ip address (A) records of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/dns/ip/{hostname}/{value}`

**Summary:** delete an ip address (A) record of a domain  
**Description:** delete an ip address (A) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `path` | ✅ Yes | Hostname |
| `value` | `string` | `path` | ✅ Yes | Value |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/dns/ip/{old_hostname}/{old_value}`

**Summary:** update a ip address (A) record of a domain  
**Description:** update a ip address (A) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `old_hostname` | `string` | `path` | ✅ Yes | Old Hostname |
| `old_value` | `string` | `path` | ✅ Yes | Old Value |
| `value` | `string` | `form` | ✅ Yes | New Value |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/dns/ipv6`

**Summary:** add a new ipv6 address (AAAA) record of a domain  
**Description:** add a new ipv6 address (AAAA) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `form` | No | Hostname |
| `value` | `string` | `form` | ✅ Yes | Value, example 2001:db8:85a3:0:0:8a2e:370:7334 |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/dns/ipv6`

**Summary:** list all ipv6 address (AAAA) records of a domain  
**Description:** list all ipv6 address (AAAA) records of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/dns/ipv6/{hostname}/{value}`

**Summary:** delete an ipv6 address (AAAA) record of a domain  
**Description:** delete an ipv6 address (AAAA) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `path` | ✅ Yes | Hostname |
| `value` | `string` | `path` | ✅ Yes | Value |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/dns/ipv6/{old_hostname}/{old_value}`

**Summary:** update a ipv6 address (AAAA) record of a domain  
**Description:** update a ipv6 address (AAAA) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `old_hostname` | `string` | `path` | ✅ Yes | Old Hostname |
| `old_value` | `string` | `path` | ✅ Yes | Old Value |
| `value` | `string` | `form` | ✅ Yes | New Value |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/dns/mx`

**Summary:** add a new mail exchanger (MX) record of a domain  
**Description:** add a new mail exchanger (MX) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `form` | No | Hostname |
| `value` | `string` | `form` | ✅ Yes | Value |
| `priority` | `integer` | `form` | No | Priority |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/dns/mx`

**Summary:** list all mail exchanger (MX) records of a domain  
**Description:** list all mail exchanger (MX) records of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/dns/mx/{hostname}/{value}`

**Summary:** delete a mail exchanger (MX) record of a domain  
**Description:** delete a mail exchanger (MX) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `path` | ✅ Yes | Hostname |
| `value` | `string` | `path` | ✅ Yes | Value |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/dns/mx/{old_hostname}/{old_value}`

**Summary:** update a mail exchanger (MX) record of a domain  
**Description:** update a mail exchanger (MX) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `old_hostname` | `string` | `path` | ✅ Yes | Old Hostname |
| `old_value` | `string` | `path` | ✅ Yes | Old Value |
| `value` | `string` | `form` | ✅ Yes | New Value |
| `priority` | `integer` | `form` | No | Priority |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/dns/ns`

**Summary:** add a new name server (NS) record of a domain  
**Description:** add a new name server (NS) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `form` | No | Hostname |
| `value` | `string` | `form` | ✅ Yes | Value, example name.bumi.orderbox-dns.com |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/dns/ns`

**Summary:** list all name server (NS) records of a domain  
**Description:** list all name server (NS) records of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/dns/ns/{hostname}/{value}`

**Summary:** delete a name server (NS) record of a domain  
**Description:** delete a name server (NS) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `path` | ✅ Yes | Hostname |
| `value` | `string` | `path` | ✅ Yes | Value |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/dns/ns/{old_hostname}/{old_value}`

**Summary:** update a name server (NS) record of a domain  
**Description:** update a name server (NS) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `old_hostname` | `string` | `path` | ✅ Yes | Old Hostname |
| `old_value` | `string` | `path` | ✅ Yes | Old Value |
| `value` | `string` | `form` | ✅ Yes | New Value |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/dns/srv`

**Summary:** add a new service (SRV) record of a domain  
**Description:** add a new service (SRV) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `form` | ✅ Yes | Hostname, example _chat._tcp.namadomain102.com , _sip._udp.subdomain.namadomain102.com |
| `value` | `string` | `form` | ✅ Yes | Value, example tcp.namadomain102.com |
| `port` | `integer` | `form` | ✅ Yes | Port |
| `weight` | `integer` | `form` | ✅ Yes | Weight |
| `priority` | `string` | `form` | ✅ Yes | Priority |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/dns/srv`

**Summary:** delete a service (SRV) record of a domain  
**Description:** delete a service (SRV) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `form` | ✅ Yes | Hostname |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/dns/srv`

**Summary:** list all service (SRV) records of a domain  
**Description:** list all service (SRV) records of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/dns/srv/{old_hostname}/{old_value}/{old_port}/{old_weight}/{old_priority}`

**Summary:** update a service (SRV) record of a domain  
**Description:** update a service (SRV) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `old_hostname` | `string` | `path` | ✅ Yes | Old Hostname |
| `old_value` | `string` | `path` | ✅ Yes | Old Value |
| `old_port` | `integer` | `path` | ✅ Yes | Old Port |
| `old_weight` | `integer` | `path` | ✅ Yes | Old Weight |
| `old_priority` | `integer` | `path` | ✅ Yes | Old Priority |
| `value` | `string` | `form` | ✅ Yes | New Value |
| `port` | `integer` | `form` | No | Port |
| `weight` | `integer` | `form` | No | Weight |
| `priority` | `string` | `form` | No | Priority |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/dns/txt`

**Summary:** add a new text (TXT) record of a domain  
**Description:** add a new text (TXT) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `form` | No | Hostname |
| `value` | `string` | `form` | ✅ Yes | Value |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/dns/txt`

**Summary:** update a text (TXT) record of a domain  
**Description:** update a text (TXT) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `old_hostname` | `string` | `form` | ✅ Yes | Old Hostname |
| `old_value` | `string` | `form` | ✅ Yes | Old Value, must use urlencode |
| `value` | `string` | `form` | ✅ Yes | New Value |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/dns/txt`

**Summary:** delete a text (TXT) record of a domain  
**Description:** delete a text (TXT) record of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `form` | ✅ Yes | Hostname |
| `value` | `string` | `form` | ✅ Yes | Value |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/dns/txt`

**Summary:** list all text (TXT) records of a domain  
**Description:** list all text (TXT) records of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

## 7. Domain Forwarding (`/domain-forwarding`)

### `GET https://api.domainsas.com/v1/domains/{domain_id}/domain_forwarding`

**Summary:** retrieve domain forwarding settings of a domain  
**Description:** retrieve domain forwarding settings of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/domain_forwarding`

**Summary:** update domain forwarding settings of a domain  
**Description:** update domain forwarding settings of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `forward_to` | `string` | `form` | No | URL where you want to forward your request.  |
| `meta_tags` | `string` | `form` | No | Sets META Tags and Page Title for the frames page which is sent to the visitor |
| `no_frames_content` | `string` | `form` | No | <br/>					Sets alternate <strong>NOFRAMES</strong> page content for search engines. Provide your HTML within <strong> < NOFRAMES > < /NOFRAMES ></strong> tags to set alternate page content.<br/>				 |
| `subdomain_forwarding` | `boolean` | `form` | No | <br/>					Possible values are true or false. For e.g. if true passed, a request made to</br><br/>					http://subdomain.domainname.com</br><br/>					will be forwarded to</br><br/>					http://destination-domainname.com/subdomain</br><br/><br/>				 |
| `path_forwarding` | `boolean` | `form` | No | <br/>					Possible values are true or false. For e.g. if true passed, a request made to</br><br/>					http://domainname.com/some/path</br><br/>					will be forwarded to</br><br/>					http://destination-domainname.com/some/path</br><br/>				 |
| `url_masking` | `boolean` | `form` | No | Possible values are true or false. If true passed, visitors will see the source URL and not the destination URL |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

## 8. Domain Operations (`/domains`)

### `POST https://api.domainsas.com/v1/domains`

**Summary:** create a new domain  
**Description:** create a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_name` | `string` | `form` | ✅ Yes | Domain name that you need to Register.<br/><br/>For an Internationalized Domain Name, refer to the supported character sets mentioned below: |
| `customer_id` | `integer` | `form` | ✅ Yes | The Customer for whom you wish to Register this domain name. |
| `registrant_contact_id` | `integer` | `form` | ✅ Yes | The <strong>Registrant Contact</strong> of the domain name. |
| `billing_contact_id` | `integer` | `form` | ✅ Yes | <br/><br/>					<p>The <strong>Billing Contact</strong> of the domain name.</p><hr><br/>					<p><strong>Note</strong></p><br/>					Pass -1 for the following TLDs:</br><br/>					.AT</br><br/>					.BERLIN</br><br/>					.CA</br><br/>					.EU</br><br/>					.NL</br><br/>					.NZ</br><br/>					.RU</br><br/>					.UK</br><br/><br/>	  |
| `admin_contact_id` | `integer` | `form` | ✅ Yes | <br/>	 				<p>The <strong>Administrative</strong> Contact of the domain name.</p><hr><br/>					<p><strong>Note</strong></p><br/>					Pass -1 for the following TLDs:</br><br/>					.EU</br><br/>					.NZ</br><br/>					.RU</br><br/>					.UK</br><br/><br/>	  |
| `tech_contact_id` | `integer` | `form` | ✅ Yes | <br/>	 	 			<p>The <strong>Technical Contact</strong> of the domain name.</p><hr><br/>					<p><strong>Note</strong></p><br/>					Pass -1 for the following TLDs:</br><br/>					.EU</br><br/>					.NZ</br><br/>					.RU</br><br/>					.UK</br><br/><br/>	  |
| `years` | `integer` | `form` | No | Years Order |
| `ns` | `string` | `form` | No | Name Server, for multi ns example ns1.domainname.com,ns2.domainname.com  |
| `purchase_privacy_protection` | `boolean` | `form` | No | Privacy Protect Order |
| `extra` | `string` | `form` | No | Extra, example for .asia domain : asia_contact_id=0 |
| `invoice_option` | `string` | `form` | ✅ Yes | Invoice Option, example keep_invoice, pay_invoice, no_invoice, only_add  |

---

### `GET https://api.domainsas.com/v1/domains`

**Summary:** retrieve domain details  
**Description:** retrieve domain details  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `limit` | `integer` | `query` | No | Limit views. This should be a value between 10 to 100. |
| `page_no` | `integer` | `query` | No | Page number for which details are to be fetched |
| `domain_id` | `integer` | `query` | No | Domain ID |
| `reseller_id` | `integer` | `query` | No | Reseller Id(s) whose Orders need to be fetched |
| `customer_id` | `integer` | `query` | No | Customer Id(s) whose Orders need to be fetched |
| `show_child_orders` | `boolean` | `query` | No | Whether Sub-Reseller Orders need to be fetched or not |
| `tld` | `string` | `query` | No | Top Level Domain |
| `status` | `string` | `query` | No | Status domain. value : Live, Unpaid, Pending, Expired, Pending Delete Restorable, Pending Transfer, Pending Restore. |
| `domain_name` | `string` | `query` | No | Name of the Domain |
| `privacy_protection_enabled` | `boolean` | `query` | No | Privacy Protect Enable |
| `creation_time_start` | `string` | `query` | No | Time for listing of Domain Registration Orders whose Creation Date is greater than creation-date-start, format: Y-m-d H:i:s |
| `creation_time_end` | `string` | `query` | No | Time for listing of Domain Registration Orders whose Creation Date is less than creation-date-end, format: Y-m-d H:i:s |
| `expiry_date_start` | `string` | `query` | No | Time for listing of Domain Registration Orders whose Expiry Date is greater than expiry-date-start, format: Y-m-d H:i:s |
| `expiry_date_end` | `string` | `query` | No | Time for listing of Domain Registration Orders whose Expiry Date is less than expiry-date-end, format: Y-m-d H:i:s |
| `reseller_email` | `string` | `query` | No | Reseller Email whose Orders need to be fetched |
| `customer_email` | `string` | `query` | No | Customer Email whose Orders need to be fetched |
| `exact_domain_name` | `integer` | `query` | No | Exact Domain Name, this will show only 1 result, with same name |

---

### `GET https://api.domainsas.com/v1/domains/availability`

**Summary:** check availability of a domain name  
**Description:** check availability of a domain name  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain` | `string` | `query` | ✅ Yes | Domain name(s) that you need to check the availability for |
| `lang` | `string` | `query` | No | IDN Language Code |

---

### `GET https://api.domainsas.com/v1/domains/details-by-name`

**Summary:** Gets details of the Domain Registration Order associated with the specified domain name.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_name` | `string` | `query` | ✅ Yes | Domain name associated with the Domain Registration Order whose details need to be fetched. |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/suggestion`

**Summary:** retrieve domain suggestion for a keyword  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `keyword` | `string` | `query` | ✅ Yes | <br/>				 Search term (keyword or phrase) e.g. 'search' or 'search world'</br></br><br/><br/>				<strong>Note</strong></br><br/>				The search term will be considered as invalid, if it contains more than one consecutive space character.<br/><br/>	  |
| `tlds` | `string` | `query` | ✅ Yes | Domain name extensions (TLDs) you want to search in |
| `limit` | `string` | `query` | ✅ Yes | Total want to appear. This should be a value between 10 to 100. |
| `hyphen_allowed` | `boolean` | `query` | No | Default value is false. Recommended value is true. If true is passed, generates suggestions with hyphens (Dashes) |
| `add_related` | `boolean` | `query` | No | Default value is false. Recommended value is true. If true is passed, generates suggestions with related keywords. |

---

### `POST https://api.domainsas.com/v1/domains/transfer`

**Summary:** transfer domain  
**Description:** transfer domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_name` | `string` | `form` | ✅ Yes | Specify the domain name that you want to transfer. |
| `customer_id` | `integer` | `form` | ✅ Yes | The Customer for whom the Order should be added. |
| `registrant_contact_id` | `integer` | `form` | ✅ Yes | The Registrant Contact of the domain name.</br><br/>										The Identity of the Registrant Contact of a .UK domain name must not be changed during the Transfer process. You may modify the Identity once the domain name has been transferred to LogicBoxes. |
| `admin_contact_id` | `integer` | `form` | ✅ Yes | <br/>						The Administrative Contact of the domain name.</br><br/>						.EU, .NZ, .RU and .UK domain names do not have an Administrative Contact associated with them. You need to pass the value of admin-contact-id as -1 for these domain names.<br/>	 			 |
| `billing_contact_id` | `integer` | `form` | ✅ Yes | <br/>						The Billing Contact of the domain name.</br><br/>						The Billing Contact associated with a .EU domain name cannot be modified while .AT, .BERLIN, .CA, .NL, .NZ, .RU and .UK domain names do not have a Billing Contact associated with them.<br/>				 |
| `tech_contact_id` | `integer` | `form` | ✅ Yes | <br/>						The Technical Contact of the domain name.</br><br/>						The Technical Contact associated with a .EU domain name cannot be modified while .NZ, .RU and .UK domain names do not have a Technical Contact associated with them. You need to pass the value of tech-contact-id as -1 for these domain names. |
| `auth_code` | `string` | `form` | No | Authorization Code (a.k.a. Domain Secret) of the domain name that you want to transfer. |
| `years` | `string` | `form` | No | Years |
| `ns` | `string` | `form` | No | List of Name Servers to be associated with the domain name. A maximum of 13 Name Servers can be specified. |
| `extra` | `string` | `form` | No | Extra, example asia_contact_id=0 |
| `invoice_option` | `string` | `form` | ✅ Yes | <br/>							This will decide how the Customer Invoice will be handled. Set any of below mentioned Invoice Options for your Customer:</br><br/>							- no_invoice </br><br/>							- pay_invoice</br><br/>							- keep_invoice</br><br/>                            - only_add</br><br/>				 |
| `purchase_privacy_protection` | `boolean` | `form` | No | Privacy Protect Order |

---

### `POST https://api.domainsas.com/v1/domains/transfer/validity`

**Summary:** retrieve transfer request validity of a domain name  
**Description:** retrieve transfer request validity of a domain name  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_name` | `string` | `form` | ✅ Yes | Domain name for which you want to check if the transfer request is valid. |
| `auth_code` | `string` | `form` | No | Auth code. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}`

**Summary:** retrieve a domain details  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | domain ID |
| `fields` | `string` | `query` | ✅ Yes | Values can be: All, domain_details, billing_contact, registrant_contact, admin_contact, tech_contact, dnssec, dns, ns, domain_forwarding, childns, raa_verification. |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}`

**Summary:** delete a domain  
**Description:** delete a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | domain id |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/auth_code`

**Summary:** update auth code of a domain  
**Description:** update auth code of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `auth_code` | `string` | `form` | ✅ Yes | New auth-code |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/auth_code`

**Summary:** retrieve auth code of a domain  
**Description:** retrieve auth code of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/childns`

**Summary:** add a new child name server for a domain  
**Description:** add a new child name server for a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `form` | ✅ Yes | Child Name Servers name that you want to add. |
| `ip_address` | `string` | `form` | ✅ Yes | IP addresses that you want to associate with the Child Name Servers. |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/childns`

**Summary:** list all child name servers of a domain  
**Description:** list all child name servers of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/childns/{hostname}/{ip_address}`

**Summary:** delete a child name server of a domain  
**Description:** delete a child name server of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `hostname` | `string` | `path` | ✅ Yes | Child Name Server's name for which the IP address needs to be deleted. |
| `ip_address` | `string` | `path` | ✅ Yes | IP address that needs to be deleted. |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/childns/{old_hostname}/{old_ip_address}`

**Summary:** update a child name server of a domain  
**Description:** update a child name server of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `old_hostname` | `string` | `path` | ✅ Yes | Current Child Name Server of the specified Order. |
| `old_ip_address` | `string` | `path` | ✅ Yes | Currently associated IP address with the specified Child Name Server. |
| `hostname` | `string` | `form` | ✅ Yes | New Child Name Server that you want to associate with the Order. |
| `ip_address` | `string` | `form` | ✅ Yes | New IP address that you want to associate with the specified Child Name Server. |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/contacts`

**Summary:** update domain contact  
**Description:** update domain contact  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | domain id |
| `registrant_contact_id` | `integer` | `form` | ✅ Yes | The Contact that you want to use as the new Registrant Contact |
| `billing_contact_id` | `integer` | `form` | ✅ Yes | The Contact that you want to use as the new Billing Contact |
| `admin_contact_id` | `integer` | `form` | ✅ Yes | The Contact that you want to use as the new Admin Contact |
| `tech_contact_id` | `integer` | `form` | ✅ Yes | The Contact that you want to use as the new Technical Contact |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/contacts-pending`

**Summary:** update domain contact (pending + execute_queue)  
**Description:** Update domain contact hanya untuk domain pending (order_status_id=2) dan domain_transaction execute_queue (status_id=2).  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | domain id |
| `registrant_contact_id` | `integer` | `form` | ✅ Yes | New Registrant Contact ID (Liquid contact_id) |
| `billing_contact_id` | `integer` | `form` | ✅ Yes | New Billing Contact ID (Liquid contact_id) |
| `admin_contact_id` | `integer` | `form` | ✅ Yes | New Admin Contact ID (Liquid contact_id) |
| `tech_contact_id` | `integer` | `form` | ✅ Yes | New Tech Contact ID (Liquid contact_id) |
| `customer_id` | `integer` | `form` | No | Customer Id (optional, untuk verifikasi ownership) |
| `is_domain_pending` | `integer` | `form` | ✅ Yes | Flag harus 1 untuk mengaktifkan endpoint ini |
| `is_trans_execute_queue` | `integer` | `form` | ✅ Yes | Flag harus 1 untuk mengaktifkan endpoint ini |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/dnssec`

**Summary:** Adding a Delegation Signer (DS) Record  
**Description:** Adds a Delegation Signer (DS) Record for a Domain Registration Order.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | domain id |
| `keytag` | `integer` | `form` | ✅ Yes | Contains the tag value of the DNSKEY Resource Record that validates this signature. An integer value in the range 0 to 65536. |
| `algorithm` | `integer` | `form` | ✅ Yes | An integer value 1,2,3,4,5,6,7,8,10,13,14,15,16,17,23,252,253,254 |
| `digesttype` | `integer` | `form` | ✅ Yes | Min 1 max 6 |
| `digest` | `string` | `form` | ✅ Yes | An alpha-numeric string generated by applying the Digest Type algorithm to a message. It needs to be a 40-character string for Digest Type value 1 and a 64-character string for Digest Type values 2 and 3. |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/dnssec`

**Summary:** Retrieve All Delegation Signer (DS) Record  
**Description:** Retrieve All Delegation Signer (DS) Record  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/dnssec/{keytag}/{algorithm}/{digesttype}/{digest}`

**Summary:** Delete a Delegation Signer (DS) Record  
**Description:** Delete a Delegation Signer (DS) Record for a Domain Registration Order.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `keytag` | `integer` | `path` | ✅ Yes | Contains the tag value of the DNSKEY Resource Record that validates this signature. An integer value in the range 0 to 65536. |
| `algorithm` | `integer` | `path` | ✅ Yes | An integer value 1, 2, 3, 4, 5, 6, 7, 8, 10, 252, 253 & 254 |
| `digesttype` | `integer` | `path` | ✅ Yes | Min 1 max 3 |
| `digest` | `string` | `path` | ✅ Yes | An alpha-numeric string generated by applying the Digest Type algorithm to a message. It needs to be a 40-character string for Digest Type value 1 and a 64-character string for Digest Type values 2 and 3. |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/irtp_verification/resend`

**Summary:** resend IRTP Verification email of a domain  
**Description:** resend IRTP Verification email of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `form` | No | Customer Id. |
| `type` | `string` | `form` | No | email or sms |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/locked`

**Summary:** locked a domain  
**Description:** locked a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `reason` | `string` | `form` | No | Reason of Locking Domain. |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/locked`

**Summary:** unlock a domain  
**Description:** unlock a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/locked`

**Summary:** retrieve domain locked status  
**Description:** retrieve domain locked status  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/move`

**Summary:** move domain  
**Description:** move domain. after move, you will get new domain ID  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | domain id |
| `existing_customer_id` | `integer` | `form` | ✅ Yes | Existing Customer ID from which the products are to be transferred |
| `new_reseller_id` | `integer` | `form` | ✅ Yes | New Reseller ID to which the products are to be transferred |
| `new_customer_id` | `integer` | `form` | ✅ Yes | New Customer ID to which the products are to be transferred |
| `default_contacts` | `string` | `form` | ✅ Yes | Value to indicate whether the old Contact has to be retained or to use the Default Contact of the new Customer. Valid entries are oldcontact or default. |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/ns`

**Summary:** update name servers of a domain  
**Description:** update name servers of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `ns` | `string` | `form` | ✅ Yes | New name server. |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/ns`

**Summary:** retrieve name servers of a domain  
**Description:** retrieve name servers of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/raa_verification`

**Summary:** retrieve RAA Verification status of a domain  
**Description:** retrieve RAA Verification status of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/raa_verification/resend`

**Summary:** resend RAA Verification email of a domain  
**Description:** resend RAA Verification email of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/renew`

**Summary:** renew domain order  
**Description:** renew domain order  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | domain id |
| `years` | `integer` | `form` | ✅ Yes | Number of years for which you want to Renew this Order. |
| `current_date` | `string` | `form` | ✅ Yes | Current Expiry Date of the Order in epoch time format. Format: Y-m-d H:i:s |
| `purchase_privacy_protection` | `boolean` | `form` | No | Renews the Privacy Protection service for the domain name |
| `invoice_option` | `string` | `form` | ✅ Yes | <br/>							This will decide how the Customer Invoice will be handled. <br/><br/>							Set any of below mentioned Invoice Options for your Customer:<br/><br/>							- no_invoice </br><br/>							- pay_invoice </br><br/>							- keep_invoice</br><br/>							- only_add<br/>				 |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/restore`

**Summary:** restore domain order  
**Description:** restore domain order  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | domain id |
| `invoice_option` | `string` | `form` | ✅ Yes | This will decide how the Customer Invoice will be handled. Set any of below mentioned Invoice Options for your Customer: keep_invoice, pay_invoice, no_invoice, only_add |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/suspended`

**Summary:** suspend a domain  
**Description:** suspend a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `reason` | `string` | `form` | No | Reason of Suspending Domain. |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/suspended`

**Summary:** unsuspend a domain  
**Description:** unsuspend a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/suspended`

**Summary:** retrieve domain suspend status  
**Description:** retrieve domain suspend status  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/theft_protection`

**Summary:** enable theft protection on a domain  
**Description:** enable theft protection on a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/theft_protection`

**Summary:** disable theft protection on a domain  
**Description:** disable theft protection on a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/theft_protection`

**Summary:** retrieve theft protection status of a domain  
**Description:** retrieve theft protection status of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/transfer/cancel`

**Summary:** Cancels the Transfer-In Order that is awaiting Admin approval.  
**Description:** Cancels the Transfer-In Order that is awaiting Admin approval.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/transfer/resend_approval_email`

**Summary:** resend transfer approval email  
**Description:** resend transfer approval email  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

## 9. Email Forwarding (`/email-forwarding`)

### `POST https://api.domainsas.com/v1/domains/{domain_id}/email_forwarding`

**Summary:** create a new email forwarding  
**Description:** create a new email forwarding  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `email` | `string` | `form` | ✅ Yes | Email |
| `forward_to` | `string` | `form` | ✅ Yes | Email Forward Destination. an email address can only forwarded to no more than 5 email addresses. |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/email_forwarding`

**Summary:** list all email forwarding  
**Description:** list all email forwarding  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/email_forwarding/catch_all`

**Summary:** update catch all email address  
**Description:** update catch all email address  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `email` | `string` | `form` | No | Email |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/email_forwarding/catch_all`

**Summary:** retrieve catch_all email forwarding  
**Description:** retrieve catch_all email forwarding  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/email_forwarding/{email}`

**Summary:** retrieve an email forwarding  
**Description:** retrieve an email forwarding  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `email` | `integer` | `path` | ✅ Yes | Email |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/email_forwarding/{email}`

**Summary:** update an email forwarding  
**Description:** update an email forwarding  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `email` | `string` | `path` | ✅ Yes | Email Source |
| `forward_to` | `string` | `form` | ✅ Yes | Email Destination, max 5 email. |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/email_forwarding/{email}`

**Summary:** delete an email forwarding  
**Description:** delete an email forwarding  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `email` | `string` | `path` | ✅ Yes | Email |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

## 10. Privacy Protection (`/privacy-protection`)

### `PUT https://api.domainsas.com/v1/domains/{domain_id}/privacy_protection`

**Summary:** enable privacy protection on a domain  
**Description:** enable privacy protection on a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

### `DELETE https://api.domainsas.com/v1/domains/{domain_id}/privacy_protection`

**Summary:** disable privacy protection on a domain  
**Description:** disable privacy protection on a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `GET https://api.domainsas.com/v1/domains/{domain_id}/privacy_protection`

**Summary:** retrieve privacy protection status of a domain  
**Description:** retrieve privacy protection status of a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `customer_id` | `integer` | `query` | No | Customer Id. |

---

### `POST https://api.domainsas.com/v1/domains/{domain_id}/privacy_protection/buy`

**Summary:** buy privacy protection service for a domain  
**Description:** buy privacy protection service for a domain  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `domain_id` | `integer` | `path` | ✅ Yes | Domain ID |
| `invoice_option` | `string` | `form` | ✅ Yes | Invoice Option, example keep_invoice, pay_invoice, no_invoice, only_add  |
| `customer_id` | `integer` | `form` | No | Customer Id. |

---

## 11. Reseller Management (`/resellers`)

### `POST https://api.domainsas.com/v1/resellers`

**Summary:** create a new reseller  
**Description:** Creates a new Reseller Account using the details provided.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `email` | `string` | `form` | ✅ Yes | Email address for the Reseller account. |
| `name` | `string` | `form` | ✅ Yes | Name of the Reseller |
| `password` | `string` | `form` | ✅ Yes | Password for the Reseller account. |
| `company` | `string` | `form` | ✅ Yes | Company Name of the Reseller |
| `address_line_1` | `string` | `form` | ✅ Yes | Address line 1 of the Reseller's address |
| `address_line_2` | `string` | `form` | No | Address line 2 of the Reseller's address |
| `address_line_3` | `string` | `form` | No | Address line 3 of the Reseller's address |
| `city` | `string` | `form` | ✅ Yes | City , example Semarang |
| `state` | `string` | `form` | ✅ Yes | State/Region/Province , example Jawa Tengah |
| `country_code` | `string` | `form` | ✅ Yes | Country Code as per ISO 3166-1 alpha-2.</br> Example ID for Indonesia |
| `zipcode` | `string` | `form` | ✅ Yes | Zip code |
| `tel_cc_no` | `string` | `form` | ✅ Yes | Telephone number Country Code |
| `tel_no` | `string` | `form` | ✅ Yes | Telephone number |
| `alt_tel_cc_no` | `string` | `form` | No | Alternate Telephone nummber Country Code |
| `alt_tel_no` | `string` | `form` | No | Alternate Telephone number  |
| `mobile_cc_no` | `string` | `form` | No | Mobile number Country Code |
| `mobile_no` | `string` | `form` | No | Mobile number |
| `fax_cc_no` | `string` | `form` | No | Fax number Country Code |
| `fax_no` | `string` | `form` | No | Fax number |
| `selling_currency` | `string` | `form` | ✅ Yes | Selling Currency Symbol of Reseller. Example : USD, IDR |

---

### `GET https://api.domainsas.com/v1/resellers`

**Summary:** list all resellers  
**Description:** Gets details of the Resellers that match the Search criteria.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `limit` | `integer` | `query` | No | Limit number of records to be fetched. This should be a value between 10 to 100. |
| `page_no` | `integer` | `query` | No | Page number for which details are to be fetched |
| `reseller_id` | `integer` | `query` | No | Reseller Id of Sub-Reseller(s) |
| `email` | `string` | `query` | No | Email address of of Sub-Reseller(s) |
| `name` | `string` | `query` | No | Name of Sub-Reseller |
| `company` | `string` | `query` | No | Company Name of Sub-Reseller |
| `city` | `string` | `query` | No | City |
| `state` | `string` | `query` | No | State |
| `country_code` | `string` | `query` | No | Country Code |
| `status` | `string` | `query` | No | Status of Sub-Reseller. Values can be Active, Suspended and Pending Activation. |
| `creation_date_start` | `string` | `query` | No | UNIX TimeStamp for listing of Sub-Resellers whose Creation Date is greater than creation-date-start |
| `creation_date_end` | `string` | `query` | No | UNIX TimeStamp for listing of Sub-Resellers whose Creation Date is less than creation-date-end |
| `total_receipts_start` | `string` | `query` | No | Total receipts of Sub-Resellers which is greater than total-receipt-start |
| `total_receipts_end` | `string` | `query` | No | Total receipts of Sub-Resellers which is less than total-receipt-end |

---

### `GET https://api.domainsas.com/v1/resellers/prices`

**Summary:** list all prices settings for resellers  
**Description:** List all Prices settings for Resellers.  

*No parameters required.*

---

### `GET https://api.domainsas.com/v1/resellers/temp_password`

**Summary:** Generates a temporary password for a Sub-Reseller.  
**Description:** Generates a temporary password for a Sub-Reseller. The generated password is valid only for 3 days.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `reseller_id` | `integer` | `query` | ✅ Yes | Reseller Id of the Sub-Reseller for whom a temporary password to be generated. |

---

### `GET https://api.domainsas.com/v1/resellers/{reseller_id}`

**Summary:** retrieve a reseller  
**Description:** Retrieves Reseller-specific details such as Personal Details, etc.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `reseller_id` | `integer` | `path` | ✅ Yes | Reseller Id of the Sub-Reseller whose details need to be fetched. In case the Reseller Id is not provided, details of the Reseller making the API call will be returned. |

---

### `PUT https://api.domainsas.com/v1/resellers/{reseller_id}`

**Summary:** update a reseller  
**Description:** Modifies the Account details of the specified Reseller.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `reseller_id` | `integer` | `path` | ✅ Yes | Reseller Id of the Reseller for whom the details need to be modified |
| `email` | `string` | `form` | ✅ Yes | Email address of the Reseller |
| `name` | `string` | `form` | ✅ Yes | Name of the Reseller |
| `company` | `string` | `form` | ✅ Yes | Company of the Reseller |
| `address_line_1` | `string` | `form` | ✅ Yes | Address line 1 of the Reseller's address |
| `address_line_2` | `string` | `form` | No | Address line 2 of the Reseller's address |
| `address_line_3` | `string` | `form` | No | Address line 3 of the Reseller's address |
| `city` | `string` | `form` | ✅ Yes | City , example Semarang |
| `state` | `string` | `form` | ✅ Yes | State/Region/Province , example Jawa Tengah |
| `country_code` | `string` | `form` | ✅ Yes | Country Code (ISO) , example ID for Indonesia |
| `zipcode` | `string` | `form` | ✅ Yes | Zip code |
| `tel_cc_no` | `integer` | `form` | ✅ Yes | Telephone number Country Code |
| `tel_no` | `integer` | `form` | ✅ Yes | Telephone number  |
| `alt_tel_cc_no` | `integer` | `form` | No | Alternate Telephone number Country Code |
| `alt_tel_no` | `integer` | `form` | No | Alternate Telephone number  |
| `mobile_cc_no` | `integer` | `form` | No | Mobile number Country Code |
| `mobile_no` | `integer` | `form` | No | Mobile number |
| `fax_cc_no` | `integer` | `form` | No | Fax number Country Code |
| `fax_no` | `integer` | `form` | No | Fax number |
| `selling_currency` | `integer` | `form` | ✅ Yes | Selling Currency Symbol.</br> Example USD, IDR |

---

### `DELETE https://api.domainsas.com/v1/resellers/{reseller_id}`

**Summary:** delete a reseller  
**Description:** Deletes the specified Reseller  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `reseller_id` | `integer` | `path` | ✅ Yes | Reseller id of the Reseller that you want to delete |

---

### `PUT https://api.domainsas.com/v1/resellers/{reseller_id}/totalreceipts`

**Summary:** update total receipts  
**Description:** Modifies Total Receipts of the specified Sub-Reseller.  

| Parameter | Type | Param Type | Required | Description |
|-----------|------|------------|----------|-------------|
| `reseller_id` | `integer` | `path` | ✅ Yes | Sub-Reseller Id of the Reseller for whom the details need to be modified |
| `totalreceipts` | `string` | `form` | ✅ Yes | New total receipts |

---
