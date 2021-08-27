# AWS Containerized Consoles

Do you use Firefox? Do you use AWS SSO to log in to many accounts and would love to simplify having two open at the same time? Well this is the extension for you!

## Why?

Having to log into your IdP on every container tab in order to have multiple AWS console sessions is extra work that we can automate away. I routinely want to fin out why things work in Account A but not in B, or if you're setting up VPC peering and want to see how quickly you can accept it on the other side, idk.

## Using this

You can download this from the Releases tab.
However because code on the internet is sus and you can't be too careful with your AWS accounts, you can also clone this repo and build it yourself.
You will have to change the email to something different in `src/manifest.json`:

```json
    "applications": {
      "gecko": {
          "id": "ur-email@here.lol"
      }
    },
```

I recommend using [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) to get your extension signed by mozilla so you can install it without too much hassle. You will need a Mozilla account to do so, you can get more info [here](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons#publishing_add-ons), but basically you register, get tokens and do the following:

```bash
~/code/aws_containerized_consoles/src(mainline) » web-ext sign --api-key <your key> --api-secret <your secret>
Building web extension from /Users/jose/code/aws_containerized_consoles/src
Validating add-on [...............................................................................................................................]
Validation results: https://an-url/here
Signing add-on [..................................................................................................................................]
Downloading signed files: 100%
Downloaded:
    ./web-ext-artifacts/aws_containerized_consoles-1.0.1-an+fx.xpi
Extension ID: containertabs@isjo.se
SUCCESS
-----------------
```

And you can drag that extension into your Firefox Addons page and 🪄!

## How does it work?

Each firefox container has its own cookie jar, which ensures you can have separate "identities," as cookies are usually used to identify. The AWS sign on page (https://signin.aws.amazon.com/saml) sets a couple of cookies that it uses to sign you through to your desired account.
What I do is to copy those cookies from your regular container into a container for your account/role you're assuming, and after making the first POST I tell firefox to not send the first signin request to the AWS console in the main container, but rather in the new one. Each account/role combination will open a new container.

### WAITWAITWAIT, can you copy all the cookies and force them off to totesleg.it/trustmebro like that?

Not really, Firefox enforces cookie access to only the urls specified in `manifest.json`, so your cookies can't be siphoned off to totesleg.it for someone to use them to log on as you.

### Securitay

I tried to set the bare minimum permissions I could and I removed them one by one to see when the extension would break. The permissions you see are the bare minimum my code needs. It is only scoped down to two pages (the SAML page where you land after signin, and the console page so we can copy in between redirects.)

## Misc.
This project uses the [Javascript Standard format](https://standardjs.com/). Any changes should follow this standard.
