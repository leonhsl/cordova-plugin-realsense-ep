#!/usr/bin/env node

module.exports = function(context) {

    var ConfigParser, XmlHelpers;
    try {
        ConfigParser = context.requireCordovaModule("cordova-lib/src/configparser/ConfigParser");
        XmlHelpers = context.requireCordovaModule("cordova-lib/src/util/xml-helpers");
    } catch (e) {
        // cordova-lib >= 5.3.4 doesn't contain ConfigParser and xml-helpers anymore
        ConfigParser = context.requireCordovaModule("cordova-common").ConfigParser;
        XmlHelpers = context.requireCordovaModule("cordova-common").xmlHelpers;
    }

    /** @external */
    var fs = context.requireCordovaModule('fs'),
        path = context.requireCordovaModule('path'),
        et = context.requireCordovaModule('elementtree');

    /** @defaults */
    var epVariables = {},
        argumentsString = context.cmdLine,
        pluginConfigurationFile = path.join(context.opts.plugin.dir, 'plugin.xml'),
        androidPlatformDir = path.join(context.opts.projectRoot,
            'platforms', 'android'),
        projectConfigurationFile = path.join(context.opts.projectRoot,
            'config.xml'),
        projectManifestFile = path.join(androidPlatformDir,
            'AndroidManifest.xml');

    /** Init */
    var CordovaConfig = new ConfigParser(projectConfigurationFile);

    var defaultPreferences = function() {
        var pluginPreferences = {};

        var pluginXmlRoot = XmlHelpers.parseElementtreeSync(pluginConfigurationFile),
            tagName = "preference",
            containerName = "config-file",
            targetPlatform = 'android',
            targetPlatformTag = pluginXmlRoot.find('./platform[@name="' + targetPlatform + '"]');

        var tagsInRoot = pluginXmlRoot.findall(tagName) || [],
            tagsInPlatform = targetPlatformTag ? targetPlatformTag.findall(tagName) : [],
            tagsInContainer = targetPlatformTag ? targetPlatformTag.findall(containerName) : [],
            tagsList = tagsInRoot.concat(tagsInContainer);

        // Parses <preference> tags within <config-file>-blocks
        tagsList.map(function(prefTag) {
            prefTag.getchildren().forEach(function(element) {
                if ((element.tag == 'preference') && (element.attrib['name']) && element.attrib['default']) {
                    pluginPreferences[element.attrib['name']] = element.attrib['default'];
                }
            });
        });

        return pluginPreferences;
    }

    /** The style of name align with config.xml */
    var setConfigPreference = function(name, value) {
        var trimName = name.replace('_', '');
        for (localName in epVariables) {
            if (localName.toUpperCase() == trimName.toUpperCase()) {
                epVariables[localName] = value;
            }
        }
    }

    /** Pase the cli command to get the specific preferece*/
    var parseCliPreference = function() {
        var commandlineVariablesList = argumentsString.split('variable');
        if (commandlineVariablesList) {
            commandlineVariablesList.forEach(function(element) {
                var spaceList = element.split(' ');
                if (spaceList) {
                    spaceList.forEach(function(element) {
                        var preference = element.split('=');
                        if (preference && preference.length == 2) {
                            setConfigPreference(preference[0], preference[1]);
                        }
                    });
                }
            });
        }
    }

    /** Add preference */
    this.addPreferences = function() {
        // Pick the variables with the cli preferences
        parseCliPreference();

        // Configure the final value in the config.xml
        var configXmlRoot = XmlHelpers.parseElementtreeSync(projectConfigurationFile);
        var preferenceUpdated = false;
        for (name in epVariables) {
            var child = configXmlRoot.find('./preference[@name="' + name + '"]');
            if(!child) {
                preferenceUpdated = true;
                child = et.XML('<preference name="' + name + '" value="' + epVariables[name] + '" />');
                XmlHelpers.graftXML(configXmlRoot, [child], '/*');
            }
        }
        if(preferenceUpdated) {
            fs.writeFileSync(projectConfigurationFile, configXmlRoot.write({indent: 4}), 'utf-8');
        }
    }

    /** Remove preference*/
    this.removePreferences = function() {
        var configXmlRoot = XmlHelpers.parseElementtreeSync(projectConfigurationFile);
        for (name in epVariables) {
            var child = configXmlRoot.find('./preference[@name="' + name + '"]');
            if (child) {
                XmlHelpers.pruneXML(configXmlRoot, [child], '/*');
            }
        }
        fs.writeFileSync(projectConfigurationFile, configXmlRoot.write({indent: 4}), 'utf-8');
    }

    epVariables = defaultPreferences();

};
